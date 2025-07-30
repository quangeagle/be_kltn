const Supplier = require('../models/Supplier');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../utils/cloudinary');
exports.registerSupplier = async (req, res) => {
  try {
    const { storeName, ownerName, email, password, phone, storeAddress } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (req.file) {
      const streamifier = require('streamifier');

      const streamUpload = (req) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'suppliers' },
            (error, result) => {
              if (result) {
                resolve(result);
              } else {
                reject(error);
              }
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req);

      const supplier = new Supplier({
        storeName,
        ownerName,
        email,
        password: hashedPassword,
        phone,
        storeAddress,
        avatar: result.secure_url
      });

      await supplier.save();
      res.status(201).json({ message: 'Đăng ký thành công', supplier });
    } else {
      return res.status(400).json({ error: 'Ảnh đại diện là bắt buộc' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.loginSupplier = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      const supplier = await Supplier.findOne({ email });
      if (!supplier) return res.status(400).json({ error: 'Supplier not found' });
  
      const isMatch = await bcrypt.compare(password, supplier.password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
  
      const token = jwt.sign({ id: supplier._id, role: 'supplier' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  
      res.status(200).json({
        message: 'Login successful',
        token,
        name: supplier.storeName,
        role: 'supplier'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  exports.getAllSuppliers = async (req, res) => {
    try {
      const suppliers = await Supplier.find().select('-password'); // Ẩn mật khẩu
      res.status(200).json({ suppliers });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch suppliers: ' + err.message });
    }
  };