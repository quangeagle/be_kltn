const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

exports.placeOrder = async (req, res) => {
  try {
    const { userId, address, paymentMethod } = req.body;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    let totalAmount = 0;
    const orderItems = [];

    for (let item of cart.items) {
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
      supplier: cart.items[0].product.supplier
    });

    await order.save();
    await Cart.findOneAndDelete({ user: userId });

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
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

    order.status = 'approved';
    await order.save();
    res.json({ message: 'Order approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
