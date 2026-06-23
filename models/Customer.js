import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true,
        match: [/^[a-zA-ZÀ-ỹ\s]+$/, 'Tên không được chứa kí tự lạ, số hoặc emoji']
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ (VD: ten@example.com)']
    },
    phone: { 
        type: String, 
        required: true,
        match: [/^\d{10}$/, 'Số điện thoại phải bao gồm đúng 10 chữ số']
    }
}, { timestamps: true });
 
export default mongoose.model('Customer', customerSchema);