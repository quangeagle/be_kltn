const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
exports.placeOrder = async (req, res) => {
  try {
    const { userId, address, paymentMethod } = req.body;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const groupedItems = {}; // { supplierId: [ {product, quantity} ] }

    // 1. Nhóm sản phẩm theo nhà cung cấp
    for (let item of cart.items) {
      const supplierId = item.product.supplier.toString();
      if (!groupedItems[supplierId]) groupedItems[supplierId] = [];

      groupedItems[supplierId].push(item);
    }

    const createdOrders = [];

    // 2. Tạo đơn hàng cho từng supplier
    for (let supplierId in groupedItems) {
      let totalAmount = 0;
      const orderItems = [];

      for (let item of groupedItems[supplierId]) {
        const product = await Product.findById(item.product._id);

        if (product.quantity < item.quantity) {
          return res.status(400).json({ error: `Product ${product.name} is out of stock` });
        }

        product.quantity -= item.quantity;
        await product.save();

        totalAmount += product.price * item.quantity;
        orderItems.push({ product: product._id, quantity: item.quantity });
      }

      const order = new Order({
        user: userId,
        items: orderItems,
        totalAmount,
        address,
        paymentMethod,
        supplier: supplierId,
      });

      await order.save();
      createdOrders.push(order);
    }

    // 3. Xóa giỏ hàng sau khi tạo đơn
    await Cart.findOneAndDelete({ user: userId });

    res.status(201).json({ message: 'Đặt hàng thành công', orders: createdOrders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('items.product');

    if (!order || order.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot cancel this order' });
    }

    // Return stock
    for (let item of order.items) {
      const product = await Product.findById(item.product._id);
      product.quantity += item.quantity;
      await product.save();
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Order cancelled and stock updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};





exports.approveOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order already processed' });

    // ✅ Duyệt đơn hàng
    order.status = 'approved';
    await order.save();

    // === 📊 Cập nhật doanh thu ===
    const now = moment();
    const weekStart = now.startOf('isoWeek').toDate();
    const weekOfYear = now.isoWeek();
    const year = now.isoWeekYear();
    const month = weekStart.getMonth() + 1;

    const supplierId = order.supplier;

    let weeklyRecord = await WeeklySalesInput.findOne({ supplier: supplierId });

    if (!weeklyRecord) {
      weeklyRecord = new WeeklySalesInput({
        supplier: supplierId,
        items: [{
          weekIndex: 0,
          weekStart,
          weekOfYear,
          year,
          month,
          weeklySales: order.totalAmount,
          holidayFlag: 0,
          temperature: null,
          fuelPrice: null,
          cpi: 100,
          unemployment: 5
        }]
      });
    } else {
      const index = weeklyRecord.items.findIndex(item =>
        moment(item.weekStart).isSame(weekStart, 'day')
      );

      if (index !== -1) {
        // 🔁 Cộng dồn vào tuần đã tồn tại
        weeklyRecord.items[index].weeklySales += order.totalAmount;
      } else {
        // ➕ Thêm mới tuần
        if (weeklyRecord.items.length >= 10) {
          weeklyRecord.items.shift(); // Xoá tuần cũ nhất
        }

        weeklyRecord.items.push({
          weekIndex: 0, // Tạm thời, lát sẽ cập nhật
          weekStart,
          weekOfYear,
          year,
          month,
          weeklySales: order.totalAmount,
          holidayFlag: 0,
          temperature: null,
          fuelPrice: null,
          cpi: 100,
          unemployment: 5
        });
      }

      // 🔁 Sắp xếp tăng dần theo weekStart rồi cập nhật weekIndex
      weeklyRecord.items.sort((a, b) => moment(a.weekStart).diff(moment(b.weekStart)));
      weeklyRecord.items.forEach((item, i) => {
        item.weekIndex = i;
      });
    }

    await weeklyRecord.save();

    res.status(200).json({
      message: '✅ Đã duyệt đơn hàng và cập nhật doanh thu tuần.',
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};







exports.getOrdersBySupplier = async (req, res) => {
  try {
    const supplierId = req.user.id; // Lấy từ token đã xác thực

    const orders = await Order.find({ supplier: supplierId })
      .populate('user', 'name email')
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


