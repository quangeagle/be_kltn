const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerAdmin = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ username, email, password: hashedPassword });
    await admin.save();
    res.status(201).json({ message: 'Admin registered successfully!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
exports.loginAdmin = async (req, res) => {
    try {
      const { username, password } = req.body;
  
      const admin = await Admin.findOne({ username });
      if (!admin) return res.status(400).json({ error: 'Admin not found' });
  
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
  
      const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  
      res.status(200).json({
        message: 'Login successful',
        token,
        name: admin.username,
        role: 'admin'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };