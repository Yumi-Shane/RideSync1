-- Waynecorp
INSERT INTO `trips` (`trip_date`, `depart`, `origin`, `dest`, `via`) VALUES
(CURDATE(), '07:00:00', 'Binga',  'Baguio', 'Guisset Road'),
(CURDATE(), '07:30:00', 'Binga',  'Baguio', 'Itogon Road'),
(CURDATE(), '13:00:00', 'Baguio', 'Binga',  'Return trip'),
(CURDATE(), '13:30:00', 'Baguio', 'Binga',  'Return trip');
