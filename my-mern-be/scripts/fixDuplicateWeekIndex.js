require('dotenv').config();
const mongoose = require('mongoose');
const WeeklySalesInput = require('../models/WeeklySalesInput');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name';
const SUPPLIER_ID = '6888403e04cc6e98c7438577'; // ID supplier của bạn

async function fixDuplicateWeekIndex() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // Tìm record của supplier
    const record = await WeeklySalesInput.findOne({ supplier: SUPPLIER_ID });
    if (!record) {
      throw new Error('Không tìm thấy supplier');
    }

    console.log('📊 Trước khi fix:');
    console.log('Tổng số items:', record.items.length);
    console.log('WeekIndex hiện tại:', record.items.map(item => item.weekIndex).sort((a, b) => a - b));

    // Tìm items duplicate weekIndex = 1
    const duplicateItems = record.items.filter(item => item.weekIndex === 1);
    console.log('🔍 Items với weekIndex = 1:', duplicateItems.length);

    if (duplicateItems.length > 1) {
      // Giữ lại item cũ nhất (2010), xóa item mới (2025)
      const itemsToKeep = duplicateItems.sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
      const itemToRemove = itemsToKeep[itemsToKeep.length - 1]; // Item mới nhất

      console.log('🗑️ Xóa item:', itemToRemove);

      // Xóa item duplicate
      record.items = record.items.filter(item => 
        !(item.weekIndex === 1 && 
          item.weekStart.getTime() === itemToRemove.weekStart.getTime())
      );

      // Sắp xếp lại theo weekIndex
      record.items.sort((a, b) => a.weekIndex - b.weekIndex);

      await record.save();
      console.log('✅ Đã xóa item duplicate');
    }

    console.log('📊 Sau khi fix:');
    console.log('Tổng số items:', record.items.length);
    console.log('WeekIndex hiện tại:', record.items.map(item => item.weekIndex).sort((a, b) => a - b));

    await mongoose.disconnect();
    console.log('✅ Hoàn tất!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
    await mongoose.disconnect();
  }
}

fixDuplicateWeekIndex();
