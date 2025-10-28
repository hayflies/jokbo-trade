function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.flash('error', '로그인이 필요합니다.');
  return res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  const isApiRequest = req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/admin/api');
  const expectsJsonResponse =
    isApiRequest ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json'));

  if (req.session && req.session.user && req.session.user.isAdmin) {
    return next();
  }

  if (!req.session || !req.session.user) {
    if (expectsJsonResponse) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    req.flash('error', '로그인이 필요합니다.');
    return res.redirect('/login');
  }

  if (expectsJsonResponse) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  req.flash('error', '관리자 권한이 필요합니다.');
  return res.redirect('/');
}

module.exports = { ensureAuthenticated, ensureAdmin };
