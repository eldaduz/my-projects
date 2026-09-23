// ╔══════════════════════════════════════════════════════════════════╗
// ║ USER MODEL — Mongoose schema for authentication                 ║
// ║                                                                  ║
// ║ KEY SECURITY FEATURES:                                          ║
// ║   - passwordHash has select: false → excluded from queries by   ║
// ║     default. Only auth.controller explicitly selects it for     ║
// ║     login. This prevents accidentally leaking hashes in API     ║
// ║     responses.                                                   ║
// ║   - toJSON transform removes _id (→ id), __v, passwordHash     ║
// ║     so they never appear in JSON responses                      ║
// ║                                                                  ║
// ║ PATTERN: toJSON transform — same pattern used in TravelerProfile║
// ║ and Trip models. Every model cleans its output the same way.    ║
// ║                                                                  ║
// ║ TEACHER Q: "Why select:false instead of just deleting in        ║
// ║ toJSON?" → toJSON only runs when converting to JSON. select:    ║
// ║ false prevents the hash from even being loaded from the DB,     ║
// ║ so it can't leak through any code path (logs, debugging, etc.) ║
// ╚══════════════════════════════════════════════════════════════════╝
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254, // RFC 5321
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
