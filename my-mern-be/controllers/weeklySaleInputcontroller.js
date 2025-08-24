const WeeklySaleInput = require('../models/WeeklySalesTestInput');

// Thêm tuần mới vào sliding window (mảng 10 tuần)
exports.addWeeklySale = async (req, res) => {
  try {
    const newWeek = req.body;

    // 1. Tìm document duy nhất (chứa mảng items)
    let doc = await WeeklySaleInput.findOne();

    if (!doc) {
      // Nếu chưa có thì tạo document mới
      doc = new WeeklySaleInput({ items: [] });
    }

    // 2. Push tuần mới vào cuối mảng
    doc.items.push(newWeek);

    // 3. Nếu mảng > 10 thì bỏ tuần đầu
    if (doc.items.length > 10) {
      doc.items.shift();
    }

    await doc.save();

    res.status(201).json({
      message: 'Thêm tuần mới thành công (sliding window 10 tuần)',
      data: doc
    });
  } catch (error) {
    console.error('❌ addWeeklySale error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Lấy danh sách 10 tuần hiện tại
exports.getWeeklySales = async (req, res) => {
  try {
    const doc = await WeeklySaleInput.findOne();
    res.status(200).json(doc ? doc.items : []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset toàn bộ mảng items
exports.resetWeeklySales = async (req, res) => {
  try {
    await WeeklySaleInput.deleteMany({});
    res.status(200).json({ message: 'Đã reset toàn bộ weekly sales input' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.addBatchWeeks = async (req, res) => {
    try {
      const weeks = req.body.weeks; // phải là array 10 tuần
      if (!Array.isArray(weeks) || weeks.length !== 10) {
        return res.status(400).json({ message: "Cần truyền đúng 10 tuần trong mảng 'weeks'" });
      }
  
      // Lấy document duy nhất (sliding window)
      let doc = await WeeklySaleInput.findOne();
      if (!doc) {
        // nếu chưa có thì tạo mới
        doc = new WeeklySaleInput({ items: [] });
      }
  
      // Nếu hiện tại có ít hơn 10 tuần thì gộp lại
      let updatedItems = [...doc.items, ...weeks];
  
      // Chỉ giữ lại 10 tuần cuối cùng
      if (updatedItems.length > 10) {
        updatedItems = updatedItems.slice(updatedItems.length - 10);
      }
  
      doc.items = updatedItems;
      await doc.save();
  
      res.json({
        message: "Thêm 10 tuần thành công (sliding window 10 tuần)",
        data: doc,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  };