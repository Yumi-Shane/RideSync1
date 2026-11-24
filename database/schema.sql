-- Waynecorp
SET NAMES utf8mb4;

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `mobile` varchar(11) NOT NULL,
  `email` varchar(190) NOT NULL,
  `pw_hash` varchar(255) NOT NULL,
  `role` enum('passenger','driver','coordinator') NOT NULL DEFAULT 'passenger',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `duty` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `vehicles` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `driver_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('Available','Assigned','Unavailable') NOT NULL DEFAULT 'Available',
  `note` varchar(200) NOT NULL DEFAULT 'Ready',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `driver_id` (`driver_id`),
  CONSTRAINT `vehicles_ibfk_1` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `trips` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_date` date NOT NULL,
  `depart` time NOT NULL,
  `origin` varchar(40) NOT NULL,
  `dest` varchar(40) NOT NULL,
  `via` varchar(80) NOT NULL DEFAULT '',
  `vehicle_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('Needs setup','Scheduled','Boarding','Departed','Completed','Delayed','Cancelled') NOT NULL DEFAULT 'Needs setup',
  `capacity` smallint(5) UNSIGNED NOT NULL DEFAULT 18,
  `walkins` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `seats` smallint(5) UNSIGNED DEFAULT NULL,
  `seats_at` datetime DEFAULT NULL,
  `prev_depart` time DEFAULT NULL,
  `unmet` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `trip_date` (`trip_date`),
  KEY `vehicle_id` (`vehicle_id`),
  CONSTRAINT `trips_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `queue_entries` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `seq` int(10) UNSIGNED NOT NULL,
  `status` enum('waiting','boarded','left') NOT NULL DEFAULT 'waiting',
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `trip_id` (`trip_id`,`status`,`seq`),
  KEY `user_id` (`user_id`,`status`),
  CONSTRAINT `queue_entries_ibfk_1` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `queue_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `announcements` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL,
  `body` varchar(300) NOT NULL DEFAULT '',
  `tag` varchar(20) NOT NULL DEFAULT 'Info',
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `notifications` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(100) NOT NULL,
  `body` varchar(300) NOT NULL DEFAULT '',
  `tag` varchar(20) NOT NULL DEFAULT 'Update',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_read` (`user_id`,`is_read`,`id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `login_attempts` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `ip_hash` char(64) NOT NULL,
  `email` varchar(190) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `password_resets` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `token_hash` (`token_hash`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `vehicles` (`name`) VALUES ('Jeepney 01'), ('Jeepney 02'), ('Jeepney 03');
INSERT INTO `announcements` (`title`, `body`, `tag`) VALUES ('Welcome to RideSync', 'Please arrive 15 minutes before departure', 'Info');
