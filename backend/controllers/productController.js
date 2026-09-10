import Product from "../models/productModel.js";


// Add a new product
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, stockQuantity, category } = req.body;

    // Validation
    if (!name || !description || !price || !stockQuantity || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, description, price, stockQuantity, category",
      });
    }

    // Check if product with same name exists
    const existingProduct = await Product.findOne({ name: name.trim() });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this name already exists",
      });
    }

    // Create product
    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      category: category.trim().toLowerCase(),
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Add product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding product",
    });
  }
};



// Get all products with optional filters and pagination
export const getProducts = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      inStock, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Build filter object
    const filter = {};

    // Search by name (case-insensitive partial match)
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Filter by category (case-insensitive)
    if (category) {
      filter.category = category.toLowerCase();
    }

    // Filter by availability (stock)
    if (inStock !== undefined) {
      if (inStock === "true") {
        filter.stockQuantity = { $gt: 0 };
      } else if (inStock === "false") {
        filter.stockQuantity = { $eq: 0 };
      }
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Product.countDocuments(filter);

    // Get products with filters and pagination
    const products = await Product.find(filter)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limitNum);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: products,
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
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
};



// Get a single product by ID
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is valid
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
    });
  }
};




// Update a product by ID
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stockQuantity, category } = req.body;

    // Check if ID is valid
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Prepare update data (only include fields that are provided)
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (price !== undefined) updateData.price = Number(price);
    if (stockQuantity !== undefined) updateData.stockQuantity = Number(stockQuantity);
    if (category) updateData.category = category.trim().toLowerCase();

    // Check for duplicate name (if name is being updated)
    if (name && name.trim() !== product.name) {
      const existingProduct = await Product.findOne({ 
        name: name.trim(),
        _id: { $ne: id } // Exclude current product
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this name already exists",
        });
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      }
    );

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product",
    });
  }
};



// Delete a product by ID
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is valid
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete product
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
    });
  }
};