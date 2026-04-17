"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { confirmPasswordReset } from "firebase/auth"; // استيراد دالة التغيير
import { auth } from "@/lib/firebase"; // تأكد من مسار ملف الفايربيس عندك

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. التأكد من تطابق كلمتي السر
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match!");
      return;
    }

    if (!oobCode) {
      setErrorMessage("Invalid or expired reset link.");
      return;
    }

    setStatus("loading");

    try {
      // 2. التنفيذ الحقيقي في Firebase
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
    } catch (error: any) {
      console.error(error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to update password.");
    }
  };

  return (
    <div className="w-full max-w-md bg-[#121214] border border-white/5 rounded-[2rem] p-8 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-[#00E5FF] to-[#9333EA] rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Secure Reset</h1>
        <p className="text-gray-400 text-sm mt-2 font-medium">Update your MrCash credentials</p>
      </div>

      {status === "success" ? (
        <div className="text-center py-6 animate-in fade-in zoom-in duration-500">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <p className="text-xl font-black text-white">Success!</p>
          <p className="text-gray-400 text-sm mt-2">Your password has been updated.</p>
          {/* إصلاح زر الانتقال للـ Login */}
          <button 
            onClick={() => router.push('/login')}
            className="mt-8 w-full py-4 bg-white text-black font-black rounded-xl hover:bg-gray-200 transition-colors"
          >
            Go to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-500 text-sm font-bold animate-shake">
              <AlertCircle className="w-5 h-5" />
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New Password</label>
            <input
              type="password"
              required
              className="w-full mt-2 bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:border-[#00E5FF] transition-all outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm Password</label>
            <input
              type="password"
              required
              className="w-full mt-2 bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:border-[#9333EA] transition-all outline-none"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            disabled={status === "loading"}
            className="w-full py-4 bg-gradient-to-r from-[#00E5FF] to-[#9333EA] text-white font-black rounded-xl shadow-[0_10px_20px_rgba(147,51,234,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {status === "loading" ? "Processing..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white font-bold animate-pulse">Loading System...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
