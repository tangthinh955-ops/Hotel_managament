import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET; // Lấy từ file .env

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Kiểm tra user có tồn tại không
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
        }

        // Đăng nhập thành công, tạo token
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ token, message: 'Đăng nhập thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
});

export default router;
