const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/userController');
const { verifyToken, isUser } = require('../middleware/authMiddleware');
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/user-profile', verifyToken, isUser, (req, res) => {
    res.json({ message: 'Welcome User Dashboard', user: req.user });
  });
module.exports = router;
