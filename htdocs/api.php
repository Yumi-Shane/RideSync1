<?php
// Waynecorp
declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);
date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');
if (!is_file(__DIR__.'/config.php')) { http_response_code(500); echo json_encode(['error'=>'Server is not configured. Copy config.sample.php to config.php and fill it in.']); exit; }
require __DIR__.'/config.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_name('rs_sid');
if (PHP_VERSION_ID >= 70300) session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Lax']);
else session_set_cookie_params(0, '/; samesite=Lax', '', $https, true);
session_start();

function out(array $d, int $c = 200): void { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $c = 400): void { out(['error'=>$m], $c); }

try {
  $db = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
  $db->exec("SET time_zone='+08:00'");
} catch (Throwable $e) { fail('Database unavailable. Check config.php.', 500); }

function col_exists(string $t, string $c): bool {
  global $db; $q = $db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?'); $q->execute([$t, $c]); return (int)$q->fetchColumn() > 0;
}
function migrate(): void {
  global $db; if (!empty($_SESSION['mig'])) return;
  try {
    $add = ['users'=>[['duty','TINYINT(1) NOT NULL DEFAULT 1']],
            'trips'=>[['seats','SMALLINT UNSIGNED NULL DEFAULT NULL'],['seats_at','DATETIME NULL DEFAULT NULL'],['prev_depart','TIME NULL DEFAULT NULL'],['unmet','SMALLINT UNSIGNED NOT NULL DEFAULT 0']]];
    foreach ($add as $t => $cols) foreach ($cols as $c) if (!col_exists($t, $c[0])) $db->exec("ALTER TABLE `$t` ADD COLUMN `{$c[0]}` {$c[1]}");
    $db->exec('CREATE TABLE IF NOT EXISTS notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, title VARCHAR(100) NOT NULL, body VARCHAR(300) NOT NULL DEFAULT \'\',
      tag VARCHAR(20) NOT NULL DEFAULT \'Update\', is_read TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      KEY user_read (user_id, is_read, id), CONSTRAINT notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $_SESSION['mig'] = 1;
  } catch (Throwable $e) { error_log('RideSync migrate: '.$e->getMessage()); }
}
migrate();

if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
$a = (string)($_GET['a'] ?? 'state');
$in = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!hash_equals($_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) fail('Session expired. Reload the page.', 403);
  $in = json_decode(file_get_contents('php://input') ?: '[]', true);
  if (!is_array($in)) $in = [];
}

if ($a !== 'state' && $_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);

function s(string $k, int $max = 255): string { global $in; $v = $in[$k] ?? ''; return is_scalar($v) ? mb_substr(trim((string)$v), 0, $max) : ''; }
function i(string $k): int { global $in; return (int)($in[$k] ?? 0); }
function uid(): ?int { return $_SESSION['uid'] ?? null; }
function me(bool $fresh = false): ?array {
  global $db; static $u = false; if ($fresh) $u = false;
  if ($u === false) {
    $u = null;
    if (uid()) { $q = $db->prepare('SELECT id,name,mobile,email,role,duty FROM users WHERE id=?'); $q->execute([uid()]); $u = $q->fetch() ?: null; if ($u) $u['duty'] = (int)$u['duty']; }
  }
  return $u;
}
function need(string ...$roles): array {
  $u = me(); if (!$u) fail('Please log in.', 401);
  if ($roles && !in_array($u['role'], $roles, true)) fail('You do not have access to this action.', 403);
  return $u;
}
function valid_date(string $d): bool { return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d,5,2), (int)substr($d,8,2), (int)substr($d,0,4)); }
function valid_pw(string $p): ?string { return (strlen($p) < 8 || strlen($p) > 72) ? 'Use 8 to 72 characters for your password.' : null; }
function ann(string $ti, string $tx, string $tag): void {
  global $db; $db->prepare('INSERT INTO announcements(title,body,tag,user_id) VALUES(?,?,?,?)')->execute([mb_substr($ti,0,100), mb_substr($tx,0,300), $tag, uid()]);
}
function notify(array $ids, string $ti, string $tx, string $tag = 'Update'): void {
  global $db; $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
  $ids = array_values(array_diff($ids, [(int)uid()])); if (!$ids) return;
  $q = $db->prepare('INSERT INTO notifications(user_id,title,body,tag) VALUES(?,?,?,?)');
  foreach ($ids as $id) $q->execute([$id, mb_substr($ti, 0, 100), mb_substr($tx, 0, 300), $tag]);
}
function coords(): array { global $db; return $db->query("SELECT id FROM users WHERE role='coordinator'")->fetchAll(PDO::FETCH_COLUMN); }
function riders(int $tid): array { global $db; $q = $db->prepare("SELECT user_id FROM queue_entries WHERE trip_id=? AND status='waiting'"); $q->execute([$tid]); return $q->fetchAll(PDO::FETCH_COLUMN); }
function driver_of(int $tid): array {
  global $db; $q = $db->prepare('SELECT v.driver_id FROM trips t JOIN vehicles v ON v.id=t.vehicle_id WHERE t.id=? AND v.driver_id IS NOT NULL'); $q->execute([$tid]); return $q->fetchAll(PDO::FETCH_COLUMN);
}
function tlabel(array $t): string { return $t['t'].' '.$t['f'].' → '.$t['to']; }
function check_full(int $tid): void {
  $t = trips('t.id=?', [$tid])[0] ?? null; if (!$t || $t['q'] < $t['cap']) return;
  notify(coords(), 'Trip is full', tlabel($t).' has no seats left. Consider assigning another vehicle.', 'Alert');
}
function trips(string $w, array $p): array {
  global $db; $u = me();
  $q = $db->prepare("SELECT t.id, TIME_FORMAT(t.depart,'%l:%i %p') AS t, TIME_FORMAT(t.depart,'%H:%i') AS t24, t.trip_date AS date,
    t.origin AS f, t.dest AS `to`, t.via, t.status AS st, t.capacity AS cap, t.walkins, t.seats, t.unmet, TIME_FORMAT(t.prev_depart,'%l:%i %p') AS prev,
    v.id AS vid, v.name AS veh, v.driver_id AS did, du.name AS drv,
    (v.driver_id <=> ?) AS mine,
    (SELECT COUNT(*) FROM queue_entries e WHERE e.trip_id=t.id AND e.status='waiting') AS w,
    (SELECT COUNT(*) FROM queue_entries e WHERE e.trip_id=t.id AND e.status='boarded') AS bd,
    (SELECT COUNT(*) FROM queue_entries e WHERE e.trip_id=t.id AND e.status='left') AS lf
    FROM trips t LEFT JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN users du ON du.id=v.driver_id
    WHERE $w ORDER BY t.trip_date, t.depart");
  $q->execute(array_merge([$u['id']], $p));
  return array_map(function ($r) use ($u) {
    $r['id'] = (int)$r['id']; $r['cap'] = (int)$r['cap']; $r['wq'] = (int)$r['w']; $r['wk'] = (int)$r['walkins']; $r['q'] = $r['wq'] + $r['wk'];
    $r['bd'] = (int)$r['bd']; $r['lf'] = (int)$r['lf']; $r['seats'] = $r['seats'] === null ? null : (int)$r['seats'];
    $r['unmet'] = $u['role'] === 'passenger' ? 0 : (int)$r['unmet'];
    $r['mine'] = (bool)$r['mine']; if ($u['role'] !== 'coordinator') { $r['drv'] = null; $r['did'] = null; }
    unset($r['w'], $r['walkins']); return $r;
  }, $q->fetchAll());
}
function waiting(int $tid): int { global $db; $q = $db->prepare("SELECT COUNT(*) FROM queue_entries WHERE trip_id=? AND status='waiting'"); $q->execute([$tid]); return (int)$q->fetchColumn(); }
function state(array $x = []): array {
  global $db; $u = me(); $r = ['csrf'=>$_SESSION['csrf'], 'user'=>$u] + $x;
  if (!$u) return $r;
  $d = (string)($_GET['d'] ?? ''); if (!valid_date($d)) $d = date('Y-m-d');
  $r['trips'] = trips('t.trip_date=?', [$d]);
  $fq = $db->prepare("SELECT v.id, v.name AS n, v.status AS s, v.note, v.driver_id AS did, COALESCE(u.name,'—') AS d, (v.driver_id = ?) AS m FROM vehicles v LEFT JOIN users u ON u.id=v.driver_id ORDER BY v.name");
  $fq->execute([$u['id']]); $f = $fq->fetchAll();
  foreach ($f as &$v) {
    $v['tr'] = []; $sts = [];
    foreach ($r['trips'] as $t) if ((int)$t['vid'] === (int)$v['id']) { $v['tr'][] = ['t'=>$t['t'], 'f'=>$t['f'], 'to'=>$t['to'], 'st'=>$t['st'], 'seats'=>$t['seats']]; $sts[] = $t['st']; }
    $v['ds'] = 'Available';
    if ($v['s'] === 'Unavailable') $v['ds'] = 'Unavailable';
    elseif (in_array('Departed', $sts, true)) $v['ds'] = 'On a trip';
    elseif (in_array('Boarding', $sts, true)) $v['ds'] = 'Boarding';
    elseif (in_array('Delayed', $sts, true)) $v['ds'] = 'Delayed';
    elseif (in_array('Scheduled', $sts, true)) $v['ds'] = 'Scheduled';
    $v['m'] = (bool)$v['m'];
    if ($u['role'] !== 'coordinator') { $v['d'] = ''; $v['did'] = null; }
  } unset($v);
  $r['fleet'] = $f;
  $r['ann'] = $db->query("SELECT title AS ti, body AS tx, tag, DATE_FORMAT(created_at,'%b %e, %l:%i %p') AS ts FROM announcements ORDER BY id DESC LIMIT 50")->fetchAll();
  $nq = $db->prepare("SELECT id, title AS ti, body AS tx, tag, is_read AS rd, DATE_FORMAT(created_at,'%b %e, %l:%i %p') AS ts FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30");
  $nq->execute([$u['id']]); $r['notes'] = $nq->fetchAll(); $r['unread'] = 0;
  foreach ($r['notes'] as &$n) { $n['rd'] = (bool)$n['rd']; if (!$n['rd']) $r['unread']++; } unset($n);
  $r['queues'] = [];
  if ($u['role'] !== 'passenger') {
    $sql = "SELECT e.trip_id AS trip, e.seq, e.status AS s, pu.name AS n, DATE_FORMAT(e.joined_at,'%l:%i %p') AS jt FROM queue_entries e JOIN users pu ON pu.id=e.user_id JOIN trips t ON t.id=e.trip_id LEFT JOIN vehicles v ON v.id=t.vehicle_id WHERE t.trip_date=?";
    $pp = [$d]; if ($u['role'] === 'driver') { $sql .= ' AND v.driver_id=?'; $pp[] = $u['id']; }
    $eq = $db->prepare($sql.' ORDER BY e.trip_id, e.seq'); $eq->execute($pp);
    foreach ($eq->fetchAll() as $e) $r['queues'][] = ['trip'=>(int)$e['trip'], 'no'=>'A-'.str_pad((string)$e['seq'], 3, '0', STR_PAD_LEFT), 's'=>$e['s'], 'n'=>$e['n'], 'at'=>$e['jt']];
  }
  $q = $db->prepare("SELECT trip_id, seq, joined_at FROM queue_entries WHERE user_id=? AND status='waiting' LIMIT 1"); $q->execute([$u['id']]); $e = $q->fetch();
  if ($e) {
    $p = $db->prepare("SELECT COUNT(*) FROM queue_entries WHERE trip_id=? AND status='waiting' AND seq<=?"); $p->execute([$e['trip_id'], $e['seq']]);
    $r['myq'] = ['trip'=>(int)$e['trip_id'], 'no'=>'A-'.str_pad((string)$e['seq'], 3, '0', STR_PAD_LEFT), 'pos'=>(int)$p->fetchColumn(),
                 'at'=>date('g:i A', strtotime($e['joined_at'])), 'tr'=>trips('t.id=?', [$e['trip_id']])[0] ?? null];
  }
  if (!$e && $u['role'] === 'passenger') {
    $l = $db->prepare("SELECT trip_id, seq FROM queue_entries WHERE user_id=? AND status='boarded' AND joined_at > NOW() - INTERVAL 12 HOUR ORDER BY id DESC LIMIT 1"); $l->execute([$u['id']]); $l = $l->fetch();
    if ($l) $r['lastq'] = ['trip'=>(int)$l['trip_id'], 'no'=>'A-'.str_pad((string)$l['seq'], 3, '0', STR_PAD_LEFT), 'tr'=>trips('t.id=?', [$l['trip_id']])[0] ?? null];
  }
  if ($u['role'] === 'coordinator') {
    $r['users'] = $db->query('SELECT id,name,email,role,duty FROM users ORDER BY name')->fetchAll(); $r['drivers'] = [];
    foreach ($r['users'] as $x) if ($x['role'] === 'driver') {
      $n = 0; foreach ($r['trips'] as $t) if ((int)$t['did'] === (int)$x['id'] && $t['st'] !== 'Cancelled') $n++;
      $x['duty'] = (bool)$x['duty']; $x['n'] = $n; $x['av'] = !$x['duty'] ? 'Off duty' : ($n > 0 ? 'Assigned' : 'Available'); $r['drivers'][] = $x;
    }
  }
  return $r;
}
function done(array $x = []): void { out(state(['ok'=>true] + $x)); }

try {
  switch ($a) {
    case 'state': out(state());

    case 'signup':
      $n = s('name', 100); $m = preg_replace('/\s+/', '', s('mobile', 20)); $e = strtolower(s('email', 190)); $p = (string)($in['password'] ?? '');
      if ($n === '' || $m === '' || $e === '' || $p === '') fail('Fill in all required fields.');
      if (!preg_match('/^09\d{9}$/', $m)) fail('Enter a mobile number like 09XX XXX XXXX.');
      if (!filter_var($e, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
      if ($err = valid_pw($p)) fail($err);
      $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
      $sc = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip_hash=? AND email LIKE 'signup:%'"); $sc->execute([$ip]);
      if ((int)$sc->fetchColumn() >= 20) fail('Too many sign-ups from this connection. Try again in 15 minutes.', 429);
      $adminOnly = defined('ADMIN_EMAIL') && ADMIN_EMAIL !== '';
      $zero = (int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
      $noCoord = (int)$db->query("SELECT COUNT(*) FROM users WHERE role='coordinator'")->fetchColumn() === 0;
      $role = ($adminOnly ? ($noCoord && strtolower((string)ADMIN_EMAIL) === $e) : $zero) ? 'coordinator' : 'passenger';
      try { $db->prepare('INSERT INTO users(name,mobile,email,pw_hash,role) VALUES(?,?,?,?,?)')->execute([$n, $m, $e, password_hash($p, PASSWORD_DEFAULT), $role]); }
      catch (PDOException $x) { if ($x->getCode() === '23000') fail('An account with this email already exists.', 409); throw $x; }
      $newId = (int)$db->lastInsertId();
      $db->prepare('INSERT INTO login_attempts(ip_hash,email) VALUES(?,?)')->execute([$ip, 'signup:'.$e]);
      session_regenerate_id(true); $_SESSION['uid'] = $newId; $_SESSION['csrf'] = bin2hex(random_bytes(32));
      done();

    case 'login':
      $e = strtolower(s('email', 190)); $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
      $db->exec('DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL 15 MINUTE');
      $c = $db->prepare('SELECT SUM(email=?), SUM(ip_hash=?) FROM login_attempts'); $c->execute([$e, $ip]); [$ce, $ci] = array_map('intval', $c->fetch(PDO::FETCH_NUM));
      if ($ce >= 6 || $ci >= 30) fail('Too many attempts. Try again in 15 minutes.', 429);
      $q = $db->prepare('SELECT id,pw_hash FROM users WHERE email=?'); $q->execute([$e]); $u = $q->fetch();
      $hash = $u['pw_hash'] ?? '$2y$10$ZN58wf/lWpP6iSghlyOIc.ILXZYsVsgY3dJBhr8NLmWxJ03ejr9Wy';
      if (!password_verify((string)($in['password'] ?? ''), $hash) || !$u) {
        $db->prepare('INSERT INTO login_attempts(ip_hash,email) VALUES(?,?)')->execute([$ip, $e]);
        fail('Email or password is incorrect.', 401);
      }
      $db->prepare('DELETE FROM login_attempts WHERE email=?')->execute([$e]);
      if (password_needs_rehash($u['pw_hash'], PASSWORD_DEFAULT)) $db->prepare('UPDATE users SET pw_hash=? WHERE id=?')->execute([password_hash((string)$in['password'], PASSWORD_DEFAULT), $u['id']]);
      session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; $_SESSION['csrf'] = bin2hex(random_bytes(32));
      done();

    case 'logout':
      $_SESSION = []; session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(32));
      out(['ok'=>true, 'csrf'=>$_SESSION['csrf'], 'user'=>null]);

    case 'forgot':
      $e = strtolower(s('email', 190)); $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
      $c = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip_hash=? AND email LIKE 'reset:%'"); $c->execute([$ip]);
      if ((int)$c->fetchColumn() < 5) {
        $db->prepare('INSERT INTO login_attempts(ip_hash,email) VALUES(?,?)')->execute([$ip, 'reset:'.$e]);
        $q = $db->prepare('SELECT id FROM users WHERE email=?'); $q->execute([$e]); $u = $q->fetch();
        if ($u) {
          $tok = bin2hex(random_bytes(32));
          $db->prepare('INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,?)')->execute([$u['id'], hash('sha256', $tok), date('Y-m-d H:i:s', time() + 3600)]);
          @mail($e, 'Reset your RideSync password', "Open this link to set a new password (valid for 1 hour):\n".APP_URL.'/?reset='.$tok."\n\nIf you did not ask for this, ignore this email.", 'From: '.MAIL_FROM);
        }
      }
      out(['ok'=>true]);

    case 'resetpw':
      $p = (string)($in['password'] ?? ''); if ($err = valid_pw($p)) fail($err);
      $q = $db->prepare('SELECT id,user_id FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>NOW()'); $q->execute([hash('sha256', s('token', 100))]); $r = $q->fetch();
      if (!$r) fail('This reset link is invalid or has expired.');
      $db->prepare('UPDATE users SET pw_hash=? WHERE id=?')->execute([password_hash($p, PASSWORD_DEFAULT), $r['user_id']]);
      $db->prepare('UPDATE password_resets SET used=1 WHERE user_id=?')->execute([$r['user_id']]);
      out(['ok'=>true]);

    case 'acct':
      $u = need(); $n = s('name', 100); $m = preg_replace('/\s+/', '', s('mobile', 20));
      if ($n === '' || !preg_match('/^09\d{9}$/', $m)) fail('Enter your name and a mobile number like 09XX XXX XXXX.');
      $db->prepare('UPDATE users SET name=?, mobile=? WHERE id=?')->execute([$n, $m, $u['id']]);
      me(true); done();

    case 'pw':
      $u = need(); $q = $db->prepare('SELECT pw_hash FROM users WHERE id=?'); $q->execute([$u['id']]);
      if (!password_verify((string)($in['current'] ?? ''), $q->fetchColumn())) fail('Current password is incorrect.');
      if ($err = valid_pw((string)($in['password'] ?? ''))) fail($err);
      $db->prepare('UPDATE users SET pw_hash=? WHERE id=?')->execute([password_hash((string)$in['password'], PASSWORD_DEFAULT), $u['id']]);
      done();

    case 'join':
      $u = need('passenger'); $db->beginTransaction();
      $q = $db->prepare('SELECT capacity,walkins,vehicle_id,status FROM trips WHERE id=? FOR UPDATE'); $q->execute([i('trip')]); $t = $q->fetch();
      if (!$t || !$t['vehicle_id'] || !in_array($t['status'], ['Scheduled','Boarding'], true)) { $db->rollBack(); fail('This trip is not open for queueing.', 409); }
      $c = $db->prepare("SELECT COUNT(*) FROM queue_entries WHERE user_id=? AND status='waiting'"); $c->execute([$u['id']]);
      if ((int)$c->fetchColumn() > 0) { $db->rollBack(); fail('You already have an active queue. Leave it before joining another.', 409); }
      if (waiting(i('trip')) + (int)$t['walkins'] >= (int)$t['capacity']) { $db->rollBack(); $db->prepare('UPDATE trips SET unmet=unmet+1 WHERE id=?')->execute([i('trip')]); fail('This trip is full.', 409); }
      $sq = $db->prepare('SELECT COALESCE(MAX(seq),0)+1 FROM queue_entries WHERE trip_id=?'); $sq->execute([i('trip')]);
      $db->prepare('INSERT INTO queue_entries(trip_id,user_id,seq) VALUES(?,?,?)')->execute([i('trip'), $u['id'], (int)$sq->fetchColumn()]);
      $db->commit(); check_full(i('trip')); done();

    case 'leave':
      $u = need('passenger'); $db->prepare("UPDATE queue_entries SET status='left' WHERE user_id=? AND status='waiting'")->execute([$u['id']]); done();

    case 'dstatus':
      $u = need('driver'); $t = trips('t.id=?', [i('trip')])[0] ?? null; if (!$t || !$t['mine']) fail('This is not your trip.', 403);
      $st = s('status', 20); if (!in_array($st, ['Boarding','Departed','Completed','Delayed','Cancelled'], true)) fail('Choose a valid status.');
      $note = s('note', 250); $rd = riders($t['id']); $lb = tlabel($t);
      $db->prepare('UPDATE trips SET status=? WHERE id=?')->execute([$st, $t['id']]);
      if (in_array($st, ['Departed','Completed'], true)) $db->prepare("UPDATE queue_entries SET status='boarded' WHERE trip_id=? AND status='waiting'")->execute([$t['id']]);
      if ($st === 'Cancelled') $db->prepare("UPDATE queue_entries SET status='left' WHERE trip_id=? AND status='waiting'")->execute([$t['id']]);
      $ti = ['Boarding'=>'Boarding now', 'Departed'=>'Trip departed', 'Completed'=>'Trip completed', 'Delayed'=>'Trip delayed', 'Cancelled'=>'Trip cancelled'][$st];
      $tx = $lb.($st === 'Boarding' ? ' is boarding. Go to the pickup point.' : ' • '.strtolower($st)).($note !== '' ? ' • '.$note : '');
      notify($rd, $ti, $tx, in_array($st, ['Delayed','Cancelled'], true) ? 'Alert' : 'Update');
      notify(coords(), 'Driver update: '.strtolower($st), $u['name'].' — '.$tx, in_array($st, ['Delayed','Cancelled'], true) ? 'Alert' : 'Update');
      if ($st === 'Delayed' || $st === 'Cancelled') ann($st === 'Delayed' ? 'Trip delay reported' : 'Trip cancelled', $t['t'].' '.$t['f'].' → '.$t['to'].($st === 'Delayed' ? ' delayed' : ' cancelled').($note !== '' ? ' • '.$note : ''), 'Alert');
      elseif ($note !== '') ann('Driver note', $t['t'].' '.$note, 'Update');
      done();

    case 'seats':
      need('driver'); $t = trips('t.id=?', [i('trip')])[0] ?? null; if (!$t || !$t['mine']) fail('This is not your trip.', 403);
      $raw = s('seats', 4);
      if ($raw === '') $db->prepare('UPDATE trips SET seats=NULL, seats_at=NULL WHERE id=?')->execute([$t['id']]);
      else {
        if (!ctype_digit($raw) || (int)$raw > (int)$t['cap']) fail('Enter a seat count from 0 to '.$t['cap'].'.');
        $db->prepare('UPDATE trips SET seats=?, seats_at=NOW() WHERE id=?')->execute([(int)$raw, $t['id']]);
      }
      done();

    case 'dveh':
      $u = need('driver'); $q = $db->prepare('SELECT id,name FROM vehicles WHERE id=? AND driver_id=?'); $q->execute([i('vehicle'), $u['id']]); $v = $q->fetch();
      if (!$v) fail('This is not your vehicle.', 403);
      $stt = s('status', 12) === 'Available' ? 'Available' : 'Unavailable'; $note = s('note', 200);
      $db->prepare('UPDATE vehicles SET status=?, note=? WHERE id=?')->execute([$stt, $note !== '' ? $note : ($stt === 'Available' ? 'Ready' : 'Vehicle problem reported by driver'), $v['id']]);
      ann('Vehicle availability', $v['name'].' marked '.strtolower($stt), 'Update');
      notify(coords(), $stt === 'Available' ? 'Vehicle available again' : 'Vehicle problem reported', $v['name'].' • '.$u['name'].($note !== '' ? ' • '.$note : ''), $stt === 'Available' ? 'Update' : 'Alert');
      done();

    case 'duty':
      $u = need('driver'); $on = i('on') ? 1 : 0; $db->prepare('UPDATE users SET duty=? WHERE id=?')->execute([$on, $u['id']]);
      if (!$on) notify(coords(), 'Driver off duty', $u['name'].' marked themselves off duty.', 'Update');
      me(true); done();

    case 'cnt':
      need('driver'); $t = trips('t.id=?', [i('trip')])[0] ?? null; if (!$t || !$t['mine']) fail('This is not your trip.', 403);
      $db->beginTransaction();
      $q = $db->prepare('SELECT capacity,walkins FROM trips WHERE id=? FOR UPDATE'); $q->execute([$t['id']]); $x = $q->fetch();
      if (i('delta') > 0) {
        if (waiting($t['id']) + (int)$x['walkins'] >= (int)$x['capacity']) { $db->rollBack(); fail('The vehicle is full.', 409); }
        $db->prepare('UPDATE trips SET walkins=walkins+1 WHERE id=?')->execute([$t['id']]); $bump = true;
      } elseif ((int)$x['walkins'] > 0) $db->prepare('UPDATE trips SET walkins=walkins-1 WHERE id=?')->execute([$t['id']]);
      else $db->prepare("UPDATE queue_entries SET status='boarded' WHERE trip_id=? AND status='waiting' ORDER BY seq LIMIT 1")->execute([$t['id']]);
      $db->commit(); if (!empty($bump)) check_full($t['id']); done();

    case 'trip_create':
      need('coordinator'); $d = s('date', 10); $tm = s('time', 5); $o = s('dir', 1) === 'o';
      if (!valid_date($d) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $tm)) fail('Enter a valid date and departure time.');
      $cap = s('cap', 3) === '' ? 18 : (int)s('cap', 3); if ($cap < 1 || $cap > 60) fail('Seats must be between 1 and 60.');
      $db->prepare('INSERT INTO trips(trip_date,depart,origin,dest,via,capacity) VALUES(?,?,?,?,?,?)')->execute([$d, $tm.':00', $o ? 'Binga' : 'Baguio', $o ? 'Baguio' : 'Binga', s('via', 80), $cap]);
      done();

    case 'trip_edit':
      need('coordinator'); $tm = s('time', 5); if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $tm)) fail('Enter a valid departure time.');
      $o = trips('t.id=?', [i('id')])[0] ?? null; if (!$o) fail('Trip not found.', 404);
      if (in_array($o['st'], ['Departed','Completed','Cancelled'], true)) fail('This trip can no longer be edited.', 409);
      $via = s('via', 80); $moved = $o['t24'] !== $tm;
      $cap = s('cap', 3) === '' ? (int)$o['cap'] : (int)s('cap', 3);
      if ($cap < 1 || $cap > 60) fail('Seats must be between 1 and 60.');
      if ($cap < $o['q']) fail('Seats cannot be fewer than the '.$o['q'].' passengers already counted.', 409);
      $db->prepare('UPDATE trips SET prev_depart=IF(depart<>?, depart, prev_depart), depart=?, via=?, capacity=? WHERE id=?')->execute([$tm.':00', $tm.':00', $via, $cap, $o['id']]);
      if ($moved || $via !== $o['via']) {
        $new = date('g:i A', strtotime($tm)); $rt = $o['f'].' → '.$o['to'];
        $tx = $moved ? $rt.': departure moved from '.$o['t'].' to '.$new.($via !== $o['via'] && $via !== '' ? ' • '.$via : '') : $rt.' ('.$o['t'].'): route note is now '.($via !== '' ? $via : 'blank');
        ann('Schedule changed', $tx, 'Schedule');
        notify(array_merge(riders($o['id']), driver_of($o['id'])), 'Schedule changed', $tx, 'Schedule');
      }
      done();

    case 'trip_cancel':
      need('coordinator'); $t = trips('t.id=?', [i('id')])[0] ?? null; if (!$t) fail('Trip not found.', 404);
      if (in_array($t['st'], ['Departed','Completed','Cancelled'], true)) fail('This trip can no longer be cancelled.', 409);
      $aud = array_merge(riders($t['id']), driver_of($t['id']));
      $db->prepare("UPDATE trips SET status='Cancelled' WHERE id=?")->execute([$t['id']]);
      $db->prepare("UPDATE queue_entries SET status='left' WHERE trip_id=? AND status='waiting'")->execute([$t['id']]);
      ann('Trip cancelled', $t['t'].' '.$t['f'].' → '.$t['to'], 'Alert');
      notify($aud, 'Trip cancelled', tlabel($t).' has been cancelled by the coordinator.', 'Alert'); done();

    case 'trip_status':
      need('coordinator'); $t = trips('t.id=?', [i('id')])[0] ?? null; if (!$t) fail('Trip not found.', 404);
      if (in_array($t['st'], ['Departed','Completed','Cancelled'], true)) fail('This trip can no longer be changed.', 409);
      $st = s('status', 12); if (!in_array($st, ['Delayed','Scheduled'], true)) fail('Invalid status.');
      if ($st === 'Scheduled' && !$t['vid']) $st = 'Needs setup';
      $note = s('note', 200); $aud = array_merge(riders($t['id']), driver_of($t['id']));
      $db->prepare('UPDATE trips SET status=? WHERE id=?')->execute([$st, $t['id']]);
      if ($st === 'Delayed') { $tx = tlabel($t).' is delayed'.($note !== '' ? ' • '.$note : ''); ann('Trip delayed', $tx, 'Alert'); notify($aud, 'Trip delayed', $tx, 'Alert'); }
      else { $tx = tlabel($t).' is back on schedule'; ann('Back on schedule', $tx, 'Update'); notify($aud, 'Back on schedule', $tx, 'Update'); }
      done();

    case 'assign':
      need('coordinator'); $t = trips('t.id=?', [i('trip')])[0] ?? null; if (!$t) fail('Trip not found.', 404);
      $v = $db->prepare('SELECT id,name,status FROM vehicles WHERE id=?'); $v->execute([i('vehicle')]); $v = $v->fetch();
      $d = $db->prepare("SELECT id FROM users WHERE id=? AND role='driver'"); $d->execute([i('driver')]);
      if (!$v || $v['status'] === 'Unavailable') fail('Choose an available vehicle.');
      if (!$d->fetch()) fail('Choose a driver. Set a person\'s role to Driver first.');
      $db->prepare("UPDATE vehicles SET driver_id=?, status='Assigned', note=? WHERE id=?")->execute([i('driver'), 'Assigned • '.$t['t'], $v['id']]);
      $db->prepare("UPDATE trips SET vehicle_id=?, status=IF(status='Needs setup','Scheduled',status) WHERE id=?")->execute([$v['id'], $t['id']]);
      notify([i('driver')], 'New trip assignment', 'You are assigned to '.tlabel($t).' with '.$v['name'].'.', 'Assignment');
      done();

    case 'vehicle_add':
      need('coordinator'); $n = s('name', 60); if ($n === '') fail('Enter a vehicle name.');
      try { $db->prepare('INSERT INTO vehicles(name) VALUES(?)')->execute([$n]); } catch (PDOException $x) { fail('That vehicle already exists.', 409); }
      done();

    case 'issue':
      need('coordinator'); $st = s('status', 12) === 'Available' ? 'Available' : 'Unavailable'; $note = s('note', 200);
      $v = $db->prepare('SELECT name FROM vehicles WHERE id=?'); $v->execute([i('vehicle')]); $n = $v->fetchColumn(); if (!$n) fail('Vehicle not found.', 404);
      $db->prepare('UPDATE vehicles SET status=?, note=? WHERE id=?')->execute([$st, $note !== '' ? $note : ($st === 'Available' ? 'Ready' : 'Maintenance reported'), i('vehicle')]);
      ann('Vehicle availability', $n.' marked '.strtolower($st), 'Update'); done();

    case 'notes_read':
      $u = need(); $db->prepare('UPDATE notifications SET is_read=1 WHERE user_id=?')->execute([$u['id']]); done();

    case 'ann_create':
      need('coordinator'); if (s('title', 100) === '') fail('Enter a title.'); ann(s('title', 100), s('body', 300), 'New'); done();

    case 'user_role':
      $u = need('coordinator'); if (i('id') === (int)$u['id']) fail('You cannot change your own role.');
      if (!in_array(s('role', 12), ['passenger','driver','coordinator'], true)) fail('Invalid role.');
      $db->prepare('UPDATE users SET role=? WHERE id=?')->execute([s('role', 12), i('id')]); done();

    case 'user_tmp_pw':
      need('coordinator'); $p = substr(strtr(base64_encode(random_bytes(9)), '+/=', 'abc'), 0, 10);
      $db->prepare('UPDATE users SET pw_hash=? WHERE id=?')->execute([password_hash($p, PASSWORD_DEFAULT), i('id')]); done(['temp'=>$p]);

    default: fail('Unknown action.', 404);
  }
} catch (Throwable $e) {
  if (isset($db) && $db->inTransaction()) $db->rollBack();
  error_log('RideSync: '.$e->getMessage());
  fail('Server error. Please try again.', 500);
}
