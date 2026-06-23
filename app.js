import 'dotenv/config'; // Load .env trước tất cả mọi thứ
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit'; // [FIX 3] Chống Brute Force
import roomRoutes from './routes/roomRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import authRoutes from './routes/authRoutes.js';
import verifyToken from './middleware/authMiddleware.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 3000;

// [FIX 3] Cấu hình Rate Limiter cho API Login chống tấn công Brute Force
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Khung thời gian: 15 phút
    max: 10,                   // Tối đa 10 lần thử đăng nhập trong 15 phút
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: '❌ Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.' }
});

// ==========================================
// MIDDLEWARES
// ==========================================
// [FIX 1] CORS chỉ cho phép đúng domain, không mở cho mọi người
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// CẤU HÌNH HTTP SERVER, SOCKET.IO VÀ REDIS
// ==========================================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Khởi tạo Redis Client
const redisClient = createClient(); // Mặc định kết nối tới redis://localhost:6379
redisClient.on('error', (err) => console.log('🔴 Lỗi Redis Client', err));
redisClient.connect().then(() => {
    console.log('🟢 Kết nối Redis Server thành công!');
});

// Lắng nghe kết nối Socket.io từ client
io.on('connection', (socket) => {
    console.log(`⚡ Một client vừa kết nối: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔴 Client đã ngắt kết nối: ${socket.id}`);
    });
});

// Middleware Inject io và redisClient vào request
app.use((req, res, next) => {
    req.io = io;
    req.redisClient = redisClient;
    next();
});

// ==========================================
// KẾT NỐI MONGODB
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotel_management';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('🟢 Kết nối MongoDB (hotel_management) thành công!');
        await initAdminUser();
    })
    .catch((err) => console.error('🔴 Lỗi kết nối MongoDB:', err));

// Script tự động tạo Admin mẫu
async function initAdminUser() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const hashedPassword = await bcrypt.hash('123456', 10);
            await User.create({ email: 'admin@gmail.com', password: hashedPassword, role: 'admin' });
            console.log('🟢 Đã tạo tài khoản admin mặc định: admin@gmail.com / 123456');
        }
    } catch (error) {
        console.error('🔴 Lỗi tạo tài khoản admin:', error);
    }
}

// ==========================================
// ROUTES SẼ GẮN Ở ĐÂY (Bước tiếp theo)
// ==========================================
app.use('/api/auth', loginLimiter, authRoutes); // ✅ Rate Limit bảo vệ login
app.use('/api/rooms', verifyToken, roomRoutes);
app.use('/api/customers', verifyToken, customerRoutes);
app.use('/api/bookings', verifyToken, bookingRoutes);

app.get('/', (req, res) => {
    res.send('API Quản lý Khách sạn đang hoạt động!');
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

// [FIX 2] Xử lý lỗi toàn cục - Bắt mọi lỗi bất ngờ, trả về JSON thay vì HTML xấu
app.use((err, req, res, next) => {
    console.error('🔴 Lỗi không được xử lý:', err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Lỗi máy chủ nội bộ'
    });
});

// [FIX 9] Đóng server an toàn (Graceful Shutdown) - Kết thúc connection khi tắt server (Ctrl+C)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    console.log('🟡 Đang tắt server an toàn...');
    server.close(async () => {
        await mongoose.connection.close();
        if (redisClient.isOpen) await redisClient.disconnect();
        console.log('✅ Server đã tắt hoàn toàn.');
        process.exit(0);
    });
}