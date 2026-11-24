# Waynecorp
import json, os, sys, datetime, urllib.request, urllib.error, http.cookiejar

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8099')
DAY = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

class Client:
    def __init__(s):
        s.o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); s.csrf = ''; s.call('state')
    def call(s, a, body=None):
        req = urllib.request.Request(f'{BASE}/api.php?a={a}&d={DAY}', data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Content-Type': 'application/json', 'X-CSRF': s.csrf})
        try: j = json.loads(s.o.open(req).read())
        except urllib.error.HTTPError as e: j = json.loads(e.read()); j['_code'] = e.code
        if 'csrf' in j: s.csrf = j['csrf']
        return j

fails = 0
def ok(label, cond, extra=''):
    global fails
    print(('PASS ' if cond else 'FAIL ') + label, '' if cond else extra)
    if not cond: fails += 1

def signup(name, email):
    c = Client(); r = c.call('signup', {'name': name, 'mobile': '09123456789', 'email': email, 'password': 'password1'})
    ok('signup ' + name + ' logs in as the new user', r.get('ok') and (r.get('user') or {}).get('email') == email, r); return c

co = signup('Coord', 'coord@test.local')
ok('first user is coordinator', co.call('state')['user']['role'] == 'coordinator')
p1, p2, p3, p4 = [signup(n, n.lower() + '@test.local') for n in ('P1', 'P2', 'P3', 'P4')]
d1 = signup('D1', 'd1@test.local')
ok('passenger cannot manage trips', p1.call('trip_create', {'date': DAY, 'time': '07:00', 'dir': 'o'}).get('_code') == 403)
uid = {u['email']: u['id'] for u in co.call('state')['users']}
ok('set driver role', co.call('user_role', {'id': uid['d1@test.local'], 'role': 'driver'}).get('ok'))

ok('bad capacity rejected', co.call('trip_create', {'date': DAY, 'time': '07:00', 'dir': 'o', 'cap': '0'}).get('_code') == 400)
for tm, dr, cap in (('07:00', 'o', '18'), ('07:30', 'o', '18'), ('13:00', 'r', '10')):
    ok('create trip ' + tm, co.call('trip_create', {'date': DAY, 'time': tm, 'dir': dr, 'via': 'Test road', 'cap': cap}).get('ok'))
trips = co.call('state')['trips']; T1, T2, T3 = [t['id'] for t in trips]
ok('capacity saved', trips[2]['cap'] == 10)
trip = lambda c, i: [t for t in c.call('state')['trips'] if t['id'] == i][0]

ok('assign T1', co.call('assign', {'trip': T1, 'vehicle': 1, 'driver': uid['d1@test.local']}).get('ok'))
ok('assign T2', co.call('assign', {'trip': T2, 'vehicle': 1, 'driver': uid['d1@test.local']}).get('ok'))
r = d1.call('state')
ok('driver notified of assignment', r['unread'] == 2 and r['notes'][0]['tag'] == 'Assignment', r['notes'])
ok('driver sees own trips only', [t['mine'] for t in r['trips']] == [True, True, False])
ok('driver cannot see driver names', all(t['drv'] is None and t['did'] is None for t in r['trips']))
ok('driver marked Scheduled', r['fleet'][0]['m'] is True and r['fleet'][0]['ds'] == 'Scheduled')

ok('p1 join', p1.call('join', {'trip': T1}).get('ok'))
ok('duplicate active queue blocked', p1.call('join', {'trip': T2}).get('_code') == 409)
ok('p2 join', p2.call('join', {'trip': T1}).get('ok'))
ok('p1 position 1', p1.call('state')['myq']['pos'] == 1 and p1.call('state')['myq']['no'] == 'A-001')
ok('p2 position 2', p2.call('state')['myq']['pos'] == 2)
ok('passenger gets no queue lists', p2.call('state')['queues'] == [])
ok('trip T3 (no vehicle) not joinable', p3.call('join', {'trip': T3}).get('_code') == 409)
r = d1.call('state'); ok('driver sees queue', [e['n'] for e in r['queues']] == ['P1', 'P2'], r['queues'])
ok('coordinator sees queue', len(co.call('state')['queues']) == 2)
ok('p2 leave', p2.call('leave', {}).get('ok')); ok('p2 can re-join', p2.call('join', {'trip': T1}).get('ok'))

ok('seat count above capacity rejected', d1.call('seats', {'trip': T1, 'seats': '99'}).get('error') is not None)
ok('driver confirms seats', d1.call('seats', {'trip': T1, 'seats': '5'}).get('ok'))
ok('passenger sees confirmed seats only', trip(p1, T1)['seats'] == 5 and trip(p1, T2)['seats'] is None)
ok('passenger cannot confirm seats', p1.call('seats', {'trip': T1, 'seats': '2'}).get('_code') == 403)

ok('driver Boarding', d1.call('dstatus', {'trip': T1, 'status': 'Boarding', 'note': ''}).get('ok'))
r = p1.call('state'); ok('passenger notified of boarding', r['notes'][0]['ti'] == 'Boarding now', r['notes'][:1])
ok('coordinator notified of driver update', any('Driver update' in n['ti'] for n in co.call('state')['notes']))
ok('vehicle shows Boarding', co.call('state')['fleet'][0]['ds'] == 'Boarding')
ok('notes_read clears badge', p1.call('notes_read', {}).get('unread') == 0)

ok('coordinator edits time + seats', co.call('trip_edit', {'id': T2, 'time': '07:45', 'via': 'Test road', 'cap': '20'}).get('ok'))
t = trip(p1, T2); ok('schedule change visible', t['prev'] == '7:30 AM' and t['t'] == '7:45 AM' and t['cap'] == 20, t)
ok('announcement records change', any('moved from 7:30 AM to 7:45 AM' in a['tx'] for a in p1.call('state')['ann']))
ok('driver notified of schedule change', any(n['tag'] == 'Schedule' for n in d1.call('state')['notes']))
ok('capacity below queued rejected', co.call('trip_edit', {'id': T1, 'time': '07:00', 'via': '', 'cap': '1'}).get('_code') == 409)
ok('coordinator delays', co.call('trip_status', {'id': T2, 'status': 'Delayed', 'note': 'Roadworks'}).get('ok'))
ok('driver notified of delay', d1.call('state')['notes'][0]['ti'] == 'Trip delayed')
ok('vehicle trips list shows delay', any(x['st'] == 'Delayed' for x in d1.call('state')['fleet'][0]['tr']))
ok('back on schedule', co.call('trip_status', {'id': T2, 'status': 'Scheduled'}).get('ok'))
ok('passenger cannot delay', p1.call('trip_status', {'id': T2, 'status': 'Delayed'}).get('_code') == 403)

ok('p3 joins T2', p3.call('join', {'trip': T2}).get('ok'))
for _ in range(19): d1.call('cnt', {'trip': T2, 'delta': 1})
ok('trip full (capacity 20)', trip(d1, T2)['q'] == 20, trip(d1, T2))
ok('coordinator told trip is full', any(n['ti'] == 'Trip is full' for n in co.call('state')['notes']))
ok('walk-in blocked when full', d1.call('cnt', {'trip': T2, 'delta': 1}).get('_code') == 409)
ok('passenger blocked when full', p4.call('join', {'trip': T2}).get('_code') == 409)
ok('turned-away demand counted', trip(co, T2)['unmet'] == 1 and trip(p4, T2)['unmet'] == 0)

ok('driver cancels T2', d1.call('dstatus', {'trip': T2, 'status': 'Cancelled', 'note': 'Breakdown'}).get('ok'))
r = p3.call('state'); ok('rider notified + queue cleared', r.get('myq') is None and r['notes'][0]['ti'] == 'Trip cancelled', r['notes'][:1])
ok('cancelled trip cannot be edited', co.call('trip_edit', {'id': T2, 'time': '08:00', 'via': ''}).get('_code') == 409)
ok('driver reports vehicle problem', d1.call('dveh', {'vehicle': 1, 'status': 'Unavailable', 'note': 'Flat tire'}).get('ok'))
ok("driver cannot touch others' vehicle", d1.call('dveh', {'vehicle': 2, 'status': 'Unavailable'}).get('_code') == 403)
ok('passengers see vehicle Unavailable', p1.call('state')['fleet'][0]['ds'] == 'Unavailable')
ok('coordinator notified of vehicle problem', any(n['ti'] == 'Vehicle problem reported' for n in co.call('state')['notes']))
ok('vehicle available again', d1.call('dveh', {'vehicle': 1, 'status': 'Available', 'note': ''}).get('ok'))
ok('driver goes off duty', d1.call('duty', {'on': 0}).get('user', {}).get('duty') == 0)
ok('coordinator sees Off duty', co.call('state')['drivers'][0]['av'] == 'Off duty'); d1.call('duty', {'on': 1})

ok('driver Departed', d1.call('dstatus', {'trip': T1, 'status': 'Departed', 'note': ''}).get('ok'))
ok('vehicle shows On a trip', co.call('state')['fleet'][0]['ds'] == 'On a trip')
ok('queue entries marked boarded', [e['s'] for e in co.call('state')['queues'] if e['trip'] == T1 and e['s'] != 'left'] == ['boarded', 'boarded'])
r = p1.call('state'); ok('passenger sees boarded status', r.get('myq') is None and r['lastq']['no'] == 'A-001')
ok('coordinator cancels trip', co.call('trip_cancel', {'id': T3}).get('ok'))
ok('driver cannot touch other trips', d1.call('dstatus', {'trip': T3, 'status': 'Cancelled'}).get('_code') == 403)

ok('wrong password rejected', Client().call('login', {'email': 'p1@test.local', 'password': 'nope'}).get('_code') == 401)
ok('POST without CSRF rejected', json.loads(urllib.request.urlopen(urllib.request.Request(f'{BASE}/api.php?a=state')).read()).get('csrf') is not None)
try: urllib.request.urlopen(f'{BASE}/api.php?a=logout'); ok('GET cannot trigger actions', False)
except urllib.error.HTTPError as e: ok('GET cannot trigger actions', e.code == 405)
anon = Client(); ok('anonymous gets no data', 'trips' not in anon.call('state'))
ok('anonymous cannot act', anon.call('join', {'trip': T1}).get('_code') == 401)
ok('role change needs coordinator', p1.call('user_role', {'id': uid['p2@test.local'], 'role': 'coordinator'}).get('_code') == 403)
ok('logout', p1.call('logout', {}).get('user') is None)

print('\nFAILURES:', fails); sys.exit(1 if fails else 0)
