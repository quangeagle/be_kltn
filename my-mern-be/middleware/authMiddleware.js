const jwt = require('jsonwebtoken');

// ✅ Xác thực JWT Token
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded = { id, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

// ✅ Phân quyền: Chỉ cho User
exports.isUser = (req, res, next) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'User access only.' });
  next();
};

// ✅ Phân quyền: Chỉ cho Admin
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
  next();
};

// ✅ Phân quyền: Chỉ cho Supplier
exports.isSupplier = (req, res, next) => {
  if (req.user.role !== 'supplier') return res.status(403).json({ error: 'Supplier access only.' });
  next();
};
