const express = require('express');
const router = express.Router();
const { registerSupplier, loginSupplier, getAllSuppliers, getSupplierById } = require('../controllers/supplierController');  
const { verifyToken, isSupplier } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
router.post('/register', upload.single('avatar'), registerSupplier);
router.post('/login', loginSupplier);
router.get('/supplier-only', verifyToken, isSupplier, (req, res) => {
    res.json({ message: 'Welcome Supplier Dashboard', user: req.user });
  });
router.get('/allsuppliers', getAllSuppliers);
router.get('/supplier/:supplierId', getSupplierById);
module.exports = router;
