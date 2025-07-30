const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin } = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/dashboard', verifyToken, isAdmin, (req, res) => {
    res.json({ message: 'Welcome Admin Dashboard', user: req.user });
  });
module.exports = router;
