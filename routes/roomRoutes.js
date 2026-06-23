import express from 'express';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js'; // Cần kiểm tra booking khi xóa phòng

const router = express.Router();

// Lấy danh sách toàn bộ phòng
router.get('/all', async (req, res) => {
    try {
        const cacheKey = 'all_rooms';

        // 1. Thử lấy dữ liệu từ Redis (chỉ thực hiện nếu Redis đang kết nối)
        if (req.redisClient && req.redisClient.isReady) {
            try {
                const cachedRooms = await req.redisClient.get(cacheKey);
                if (cachedRooms) {
                    // CACHE HIT: Trả về ngay lập tức dữ liệu từ Redis
                    console.log("⚡ Lấy danh sách phòng từ Redis Cache");
                    return res.status(200).json(JSON.parse(cachedRooms));
                }
            } catch (redisErr) {
                console.log("🔴 Bỏ qua Redis do lỗi lấy cache:", redisErr.message);
            }
        }

        // 2. CACHE MISS hoặc Redis chưa bật: Truy vấn MongoDB
        console.log("🐌 Lấy danh sách phòng từ MongoDB");
        const rooms = await Room.find();

        // 3. Lưu vào Redis (chỉ thực hiện nếu Redis đang kết nối)
        if (req.redisClient && req.redisClient.isReady) {
            try {
                await req.redisClient.setEx(cacheKey, 3600, JSON.stringify(rooms));
            } catch (redisErr) {}
        }

        res.status(200).json(rooms);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

// Thêm phòng mới
router.post('/create', async (req, res) => {
    try {
        const newRoom = await Room.create(req.body);
        
        // [THỰC CHIẾN] - Xóa Cache Redis khi có phòng mới được thêm
        if (req.redisClient && req.redisClient.isReady) {
            try {
                await req.redisClient.del('all_rooms');
            } catch (redisErr) {}
        }

        res.status(201).json(newRoom);
    } catch (error) {
        res.status(400).json({ message: "Lỗi thêm phòng (Có thể trùng số phòng)", error: error.message });
    }
});

// Cập nhật thông tin phòng
router.put('/update/:id', async (req, res) => {
    try {
        const { roomNumber, type, price, status } = req.body;
        const updatedRoom = await Room.findByIdAndUpdate(
            req.params.id,
            { roomNumber, type, price, status }, // Chỉ cập nhật các field này
            { new: true, runValidators: true }    // runValidators: bắt Schema validate khi update
        );
        if (!updatedRoom) return res.status(404).json({ message: "Không tìm thấy phòng" });
        
        // Xóa Cache Redis khi phòng bị sửa
        if (req.redisClient && req.redisClient.isReady) {
            try { await req.redisClient.del('all_rooms'); } catch (redisErr) {}
        }

        res.status(200).json(updatedRoom);
    } catch (error) {
        res.status(400).json({ message: "Lỗi cập nhật", error: error.message });
    }
});

// Xóa phòng
router.delete('/delete/:id', async (req, res) => {
    try {
        // [FIX 6] Kiểm tra xem phòng có đang được đặt không trước khi xóa
        const activeBooking = await Booking.findOne({ roomId: req.params.id, status: 'Active' });
        if (activeBooking) {
            return res.status(400).json({
                message: "❌ Không thể xóa! Phòng này đang có khách đặt. Hãy hủy đơn đặt phòng trước."
            });
        }

        const deletedRoom = await Room.findByIdAndDelete(req.params.id);
        if (!deletedRoom) return res.status(404).json({ message: "Không tìm thấy phòng" });
        
        // Xóa Cache Redis khi phòng bị xóa
        if (req.redisClient && req.redisClient.isReady) {
            try { await req.redisClient.del('all_rooms'); } catch (redisErr) {}
        }

        res.status(200).json({ message: "Đã xóa phòng thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi xóa phòng", error: error.message });
    }
});

export default router; 