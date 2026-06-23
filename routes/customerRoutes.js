import express from 'express';
import Customer from '../models/Customer.js';
import Booking from '../models/Booking.js';

const router = express.Router();

router.get('/all', async (req, res) => {
    try {
        const customers = await Customer.find();
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

router.post('/create', async (req, res) => {
    try {
        const newCustomer = await Customer.create(req.body);
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(400).json({ message: "Lỗi thêm khách (Có thể trùng Email)", error: error.message });
    }
});

router.put('/update/:id', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            { name, email, phone },
            { new: true, runValidators: true }
        );
        if (!updatedCustomer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });
        res.status(200).json(updatedCustomer);
    } catch (error) {
        res.status(400).json({ message: "Lỗi cập nhật", error: error.message });
    }
});

router.delete('/delete/:id', async (req, res) => {
    try {
        // Kiểm tra booking active
        const activeBooking = await Booking.findOne({ 
            customerId: req.params.id, 
            status: 'Active'
        });
        if (activeBooking) {
            return res.status(400).json({ 
                message: "❌ Không thể xóa! Khách hàng này đang có đơn đặt phòng hoạt động. Hãy hủy đơn trước." 
            });
        }

        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
        if (!deletedCustomer) return res.status(404).json({ message: "Không tìm thấy khách hàng" });
        res.status(200).json({ message: "Đã xóa khách hàng" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xóa khách", error: error.message });
    }
});

export default router;