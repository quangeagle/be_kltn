const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const cron = require('node-cron');
const { generateWeeklyReport } = require('./services/weeklyReport');

// 📅 Chạy vào 8h sáng Chủ nhật hàng tuần
cron.schedule('0 8 * * 0', async () => {
  console.log('🕗 Đang chạy tổng kết doanh thu tuần...');
  await generateWeeklyReport();
});
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const fuelRoutes = require('./routes/fuel');
const weatherRoutes = require('./routes/weather');
const predictRoutes = require('./routes/predict');
const revenueRoutes = require('./routes/revenue');  
const weeklySalesInputRoutes = require('./routes/weeklySalesInputRoutes');
app.use(cors({
  origin: ['http://localhost:5173', 'https://fe-kltn.vercel.app'],
  credentials: true,
}));

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/weekly-sales', weeklySalesInputRoutes);
// Routes
app.get('/', (req, res) => {
  res.send('🔥 Backend is running!');
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true, // Thêm dòng này
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch((err) => console.error('❌ MongoDB connection error:', err));
