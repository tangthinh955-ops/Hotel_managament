import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
    },
    password: { 
        type: String, 
        required: true,
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
    },
    role: { 
        type: String, 
        enum: ['admin', 'staff'], // Chỉ cho phép 2 vai trò này
        default: 'staff'
    }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
