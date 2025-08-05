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

    order.status = 'approved';
    await order.save();

    // === Cập nhật doanh thu ===
    const now = new Date();
    const weekStart = moment(now).startOf('isoWeek').toDate(); // Thứ Hai đầu tuần
    const weekOfYear = moment(now).isoWeek();
    const year = moment(now).isoWeekYear();
    const month = weekStart.getMonth() + 1;

    const supplierId = order.supplier;

    // Tìm bản ghi WeeklySalesInput của supplier
    let weeklyRecord = await WeeklySalesInput.findOne({ supplier: supplierId });

    const newItem = {
      weekIndex: moment(now).diff(moment('2024-01-01'), 'weeks'), // hoặc tính theo số tuần thực tế
      weekStart,
      year,
      weekOfYear,
      month,
      weeklySales: order.totalAmount,
      holidayFlag: 0,
      temperature: 25,
      fuelPrice: 20,
      cpi: 100,
      unemployment: 5
    };

    if (!weeklyRecord) {
      // Nếu chưa có bản ghi → tạo mới với 1 item
      weeklyRecord = new WeeklySalesInput({
        supplier: supplierId,
        items: [newItem]
      });
    } else {
      // Kiểm tra xem tuần này đã tồn tại trong items chưa
      const existingIndex = weeklyRecord.items.findIndex(item =>
        moment(item.weekStart).isSame(weekStart, 'day')
      );

      if (existingIndex !== -1) {
        // Nếu đã tồn tại → cộng dồn doanh thu
        weeklyRecord.items[existingIndex].weeklySales += order.totalAmount;
      } else {
        // Nếu chưa có → thêm tuần mới
        if (weeklyRecord.items.length >= 10) {
          // Xóa tuần cũ nhất
          weeklyRecord.items.shift();
        }
        weeklyRecord.items.push(newItem);
      }
    }

    await weeklyRecord.save();

    res.status(200).json({ message: 'Đã duyệt đơn hàng và cập nhật doanh thu tuần.', order });
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


