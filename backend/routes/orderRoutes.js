import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// User routes
router.post("/", createOrder);
router.get("/", getUserOrders);
router.get("/:id", getOrder);
router.patch("/:id/cancel", cancelOrder);

// Admin only routes
router.patch("/:id/status", authorize("admin"), updateOrderStatus);

export default router;