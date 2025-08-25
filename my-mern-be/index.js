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


// 📝 Chạy vào 5h sáng thứ 2 hàng tuần để tạo PredictionLog mới
cron.schedule('0 5 * * 1', async () => {
  console.log('📝 Đang tạo PredictionLog mới cho tuần tiếp theo...');
  try {
    const { createNextWeekPredictionLog } = require('./controllers/predictionLogController');
    // Gọi controller để tạo PredictionLog mới
    const mockReq = { body: {} };
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            console.log('✅ Tạo PredictionLog mới thành công:', data.message);
          } else {
            console.log('⚠️ Tạo PredictionLog mới:', data.error);
          }
        }
      })
    };
    await createNextWeekPredictionLog(mockReq, mockRes);
  } catch (error) {
    console.error('❌ Lỗi tạo PredictionLog mới:', error);
  }
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
const weeklySaleInputRoutes2 = require('./routes/weeklySaleInput');
const predictionTestRoutes = require('./routes/Pre2Routes');
const predictionLogRoutes = require('./routes/predictionLogRoutes');
const testRoutes = require('./routes/testRoutes')
const predictionRoutes = require('./routes/Pre1');
const predictionTestLogRoutes = require('./routes/predictionTestLogRoutes');
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
app.use('/api/weekly-sales2', weeklySaleInputRoutes2);
app.use('/api/prediction-test', predictionTestRoutes);
app.use('/api/prediction-logs', predictionLogRoutes);
app.use('/api/test', testRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/prediction-test-log', predictionTestLogRoutes);
app.get('/', (req, res) => {
  res.send('🔥 Backend is running!');
});
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true, 
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch((err) => console.error('❌ MongoDB connection error:', err));
