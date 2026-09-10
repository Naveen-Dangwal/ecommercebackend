import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import mongoose from "mongoose";


// Create a new order
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products } = req.body;
    const userId = req.userId;

    // Validate products array
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one product",
      });
    }

    // Validate each product in the array
    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      if (!item.productId || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Product ${i + 1}: Both productId and quantity are required`,
        });
      }
      if (item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Product ${i + 1}: Quantity must be at least 1`,
        });
      }
    }

    // Check if all products exist and have enough stock
    const productIds = products.map((item) => item.productId);
    const existingProducts = await Product.find({
      _id: { $in: productIds },
    }).session(session);

    // Check if all products exist
    if (existingProducts.length !== productIds.length) {
      const existingIds = existingProducts.map((p) => p._id.toString());
      const missingIds = productIds.filter(
        (id) => !existingIds.includes(id.toString())
      );
      return res.status(404).json({
        success: false,
        message: `Products not found: ${missingIds.join(", ")}`,
      });
    }

    // Map products for quick lookup
    const productMap = {};
    existingProducts.forEach((product) => {
      productMap[product._id.toString()] = product;
    });

    // Validate stock and calculate total
    let totalAmount = 0;
    const orderProducts = [];

    for (const item of products) {
      const product = productMap[item.productId];
      
      // Check stock
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
        });
      }

      // Reduce stock
      product.stockQuantity -= item.quantity;
      await product.save({ session });

      // Calculate total
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      // Prepare order product data
      orderProducts.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Create order
    const order = await Order.create(
      [
        {
          user: userId,
          products: orderProducts,
          totalAmount: totalAmount,
          status: "pending",
        },
      ],
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Populate order with product details for response
    const populatedOrder = await Order.findById(order[0]._id)
      .populate("user", "name email")
      .populate("products.product", "name description price category");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating order",
    });
  }
};





export const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter = { user: userId };
    if (status) {
      filter.status = status;
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const totalCount = await Order.countDocuments(filter);

    // Get orders
    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate("products.product", "name description price category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
    });
  }
};




// Get a single order by ID (User can view their own order)
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find order and populate details
    const order = await Order.findById(id)
      .populate("user", "name email")
      .populate("products.product", "name description price category stockQuantity");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user is authorized to view this order
    if (order.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching order",
    });
  }
};


// update order status Private (Admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Validate status
    const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`,
      });
    }

    // Find order
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update status
    order.status = status;
    await order.save();

    // Populate for response
    const updatedOrder = await Order.findById(id)
      .populate("user", "name email")
      .populate("products.product", "name description price");

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating order status",
    });
  }
};



//   Cancel order (User can cancel their own order)
export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find order
    const order = await Order.findById(id).session(session);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user is authorized
    if (order.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order",
      });
    }

    // Check if order can be cancelled
    if (order.status === "shipped" || order.status === "delivered") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled as it is already ${order.status}`,
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    // Restore stock
    for (const item of order.products) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        product.stockQuantity += item.quantity;
        await product.save({ session });
      }
    }

    // Update order status
    order.status = "cancelled";
    await order.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Populate for response
    const cancelledOrder = await Order.findById(id)
      .populate("user", "name email")
      .populate("products.product", "name description price");

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling order",
    });
  }
};