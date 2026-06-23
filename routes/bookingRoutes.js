import express from 'express';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js'; // Phải Import Room để còn cập nhật trạng thái

const router = express.Router();

// Lấy danh sách booking
router.get('/all', async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('roomId', 'roomNumber type price')
            .populate('customerId', 'name phone');
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

// Tạo booking mới
router.post('/create', async (req, res) => {
    try {
        const { roomId, customerId, checkInDate, checkOutDate } = req.body;

        // Validate ngày check-in/check-out
        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({ message: "Thiếu ngày nhận hoặc trả phòng!" });
        }
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(0, 0, 0, 0);

        if (checkIn < today) {
            return res.status(400).json({ message: "Lỗi: Ngày nhận phòng không được ở trong quá khứ!" });
        }
        if (checkOut <= checkIn) {
            return res.status(400).json({ message: "Lỗi: Ngày trả phòng phải lớn hơn ngày nhận phòng ít nhất 1 ngày!" });
        }

        // Kiểm tra trạng thái phòng
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: "Không tìm thấy phòng này!" });
        }
        if (room.status === 'Booked') {
            return res.status(400).json({ message: "Lỗi: Phòng này đã có người đặt!" });
        }

        const newBooking = await Booking.create({
            roomId,
            customerId,
            checkInDate,
            checkOutDate
        });

        // Đổi trạng thái phòng
        room.status = 'Booked';
        await room.save();

        // Xóa cache phòng
        if (req.redisClient && req.redisClient.isReady) {
            try {
                await req.redisClient.del('all_rooms');
            } catch (redisErr) {
                console.log("🔴 Lỗi xóa cache Redis:", redisErr.message);
            }
        }

        // Thông báo qua Socket.io
        if (req.io) {
            req.io.emit('new_booking_alert', { roomNumber: room.roomNumber });
        }

        res.status(201).json({ message: "Đặt phòng thành công!", booking: newBooking });
    } catch (error) {
        res.status(400).json({ message: "Lỗi tạo đơn đặt", error: error.message });
    }
});

// Cập nhật booking
router.put('/update/:id', async (req, res) => {
    try {
        const { roomId, customerId, checkInDate, checkOutDate } = req.body;
        
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Không tìm thấy đơn đặt phòng" });

        // Xử lý đổi phòng
        if (roomId && (!booking.roomId || roomId !== booking.roomId.toString())) {
            const newRoom = await Room.findById(roomId);
            if (!newRoom) return res.status(404).json({ message: "Phòng mới không tồn tại" });
            if (newRoom.status === 'Booked') return res.status(400).json({ message: "Phòng mới đã có người đặt!" });

            if (booking.roomId) {
                await Room.findByIdAndUpdate(booking.roomId, { status: 'Available' });
            }
            newRoom.status = 'Booked';
            await newRoom.save();
        }

        // Cập nhật thông tin booking
        const { roomId: newRoomId, customerId: newCustomerId, checkInDate: newCheckIn, checkOutDate: newCheckOut } = req.body;
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { roomId: newRoomId, customerId: newCustomerId, checkInDate: newCheckIn, checkOutDate: newCheckOut },
            { new: true, runValidators: true }
        );

        // Xóa cache phòng
        if (req.redisClient && req.redisClient.isReady) {
            try {
                await req.redisClient.del('all_rooms');
            } catch (redisErr) {
                console.log("🔴 Lỗi xóa cache Redis:", redisErr.message);
            }
        }

        res.status(200).json({ message: "Cập nhật đơn đặt thành công!", booking: updatedBooking });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi cập nhật đơn đặt", error: error.message });
    }
});

// Hủy/Xóa booking
router.delete('/delete/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Không tìm thấy đơn đặt phòng" });
        }
        if (booking.status === 'Canceled') {
            return res.status(400).json({ message: "Đơn đặt phòng này đã bị hủy từ trước!" });
        }

        // Giải phóng phòng
        if (booking.roomId) {
            await Room.findByIdAndUpdate(booking.roomId, { status: 'Available' });
        }

        // Soft delete booking
        booking.status = 'Canceled';
        await booking.save();

        // Xóa cache phòng
        if (req.redisClient && req.redisClient.isReady) {
            try {
                await req.redisClient.del('all_rooms');
            } catch (redisErr) {
                console.log("🔴 Lỗi xóa cache Redis:", redisErr.message);
            }
        }

        res.status(200).json({ message: "Đã thao tác hủy đơn đặt thành công và trả lại phòng trống!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi hủy đơn", error: error.message });
    }
});

export default router; 