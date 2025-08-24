const WeeklySales = require('../models/WeeklySalesInput');
const mongoose = require('mongoose');

exports.getActualRevenue = async (req, res) => {
  const supplierId = req.params.supplierId;

  try {
    const logs = await WeeklySales.aggregate([
      { $match: { supplier: new mongoose.Types.ObjectId(supplierId) } },
      { $unwind: "$items" }, // bung mảng items thành từng bản ghi
      { $match: { "items.weeklySales": { $ne: null } } },
      { $sort: { "items.weekStart": -1 } }, // tuần mới nhất trước
      { $limit: 10 }, // chỉ lấy 10 tuần
      { 
        $project: {
          _id: 0,
          weekOfYear: "$items.weekOfYear",
          year: "$items.year",
          weekStart: "$items.weekStart",
          actualWeeklySales: "$items.weeklySales"
        }
      }
    ]);

    res.json(logs.reverse()); // đảo ngược để tuần cũ -> mới cho vẽ biểu đồ
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lấy doanh thu thực tế." });
  }
};
