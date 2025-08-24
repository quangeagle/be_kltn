const { updateFuelPriceForAll, updateFuelPriceForNewWeek } = require('./fuelUpdater');
const { updateTemperatureForAll, updateTemperatureForNewWeek } = require('./weatherUpdater');
const moment = require('moment');

// Hàm cập nhật dữ liệu thông minh
async function smartUpdateData() {
  const now = moment();
  const currentDay = now.day(); // 0 = Chủ nhật, 1 = Thứ 2
  const currentWeek = now.isoWeek();
  const currentYear = now.isoWeekYear();
  
  console.log(`🕐 Thời gian hiện tại: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`📅 Ngày trong tuần: ${currentDay} (${currentDay === 1 ? 'Thứ 2' : 'Khác'})`);
  console.log(`📊 Tuần ${currentWeek}, Năm ${currentYear}`);

  try {
    // 1. LUÔN cập nhật giá xăng và nhiệt độ cho tuần hiện tại (để dự đoán ngay lập tức)
    console.log('🔄 Bước 1: Cập nhật dữ liệu cho tuần hiện tại (để dự đoán ngay lập tức)...');
    
    console.log('⛽ Cập nhật giá xăng cho tuần hiện tại...');
    await updateFuelPriceForAll();
    
    console.log('🌡️ Cập nhật nhiệt độ cho tuần hiện tại...');
    await updateTemperatureForAll();
    
    console.log('✅ Hoàn tất cập nhật dữ liệu cho tuần hiện tại!');

    // 2. Nếu là thứ 2, cập nhật thêm cho tuần mới
    if (currentDay === 1) {
      console.log('🆕 Bước 2: Hôm nay là thứ 2, cập nhật dữ liệu cho tuần mới...');
      
      console.log('⛽ Cập nhật giá xăng cho tuần mới...');
      await updateFuelPriceForNewWeek();
      
      console.log('🌡️ Cập nhật nhiệt độ cho tuần mới...');
      await updateTemperatureForNewWeek();
      
      console.log('✅ Hoàn tất cập nhật dữ liệu cho tuần mới!');
    } else {
      console.log('📅 Không phải thứ 2, bỏ qua cập nhật tuần mới');
    }

    console.log('🎯 Kết quả cập nhật thông minh:');
    console.log(`   - Dữ liệu tuần ${currentWeek}/${currentYear} đã được cập nhật (có thể dự đoán ngay)`);
    if (currentDay === 1) {
      console.log(`   - Tuần mới đã được khởi tạo với dữ liệu mới nhất`);
    }
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình cập nhật thông minh:', error);
    throw error;
  }
}

// Hàm cập nhật chỉ cho tuần hiện tại (cho GitHub Action chạy mỗi 10 phút)
async function updateCurrentWeekData() {
  console.log('🔄 Cập nhật dữ liệu cho tuần hiện tại (GitHub Action - 10 phút/lần)...');
  
  try {
    await updateFuelPriceForAll();
    await updateTemperatureForAll();
    
    console.log('✅ Hoàn tất cập nhật dữ liệu tuần hiện tại!');
  } catch (error) {
    console.error('❌ Lỗi cập nhật tuần hiện tại:', error);
    throw error;
  }
}

// Hàm cập nhật tuần mới (chỉ chạy vào thứ 2)
async function updateNewWeekData() {
  console.log('🆕 Cập nhật dữ liệu cho tuần mới (chỉ chạy vào thứ 2)...');
  
  try {
    await updateFuelPriceForNewWeek();
    await updateTemperatureForNewWeek();
    
    console.log('✅ Hoàn tất cập nhật dữ liệu tuần mới!');
  } catch (error) {
    console.error('❌ Lỗi cập nhật tuần mới:', error);
    throw error;
  }
}

module.exports = {
  smartUpdateData,        // Cập nhật thông minh (kiểm tra ngày và cập nhật phù hợp)
  updateCurrentWeekData,  // Chỉ cập nhật tuần hiện tại (cho GitHub Action)
  updateNewWeekData       // Chỉ cập nhật tuần mới (cho thứ 2)
};
