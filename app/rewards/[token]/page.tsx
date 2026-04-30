"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Shield, Camera, CheckCircle, AlertCircle, Loader2,
  UserCheck, ChevronRight, Zap, Lock, FileText
} from "lucide-react";
import { rewardService } from "@/app/services/rewardService";
import type { Reward } from "@/lib/types/reward";

type Step = "verify" | "capture" | "review" | "done" | "error";

export default function RewardPortalPage() {
  const params = useParams();
  const token = params.token as string;

  // State
  const [step, setStep] = useState<Step>("verify");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [message, setMessage] = useState("");

  // Identity verification
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // CCCD data
  const [idName, setIdName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [consent, setConsent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate token on load
  useEffect(() => {
    const validate = async () => {
      setLoading(true);
      const result = await rewardService.validateToken(token);
      if (!result.valid) {
        setMessage(result.message);
        setStep("error");
        if (result.reward) setReward(result.reward);
      } else {
        setReward(result.reward);
      }
      setLoading(false);
    };
    validate();
  }, [token]);

  // Identity verification
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (val.length > 3) {
      val = val.slice(0, 3) + "-" + val.slice(3, 8);
    }
    setPlate(val);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 7) {
      val = `${val.slice(0, 4)} ${val.slice(4, 7)} ${val.slice(7, 10)}`;
    } else if (val.length > 4) {
      val = `${val.slice(0, 4)} ${val.slice(4, 7)}`;
    }
    setPhone(val);
  };

  const handleVerify = async () => {
    setVerifyError("");
    const cleanPlate = plate.replace("-", "");
    const cleanPhone = phone.replace(/\s/g, "");

    // Synchronized validation with login page
    if (!cleanPlate || cleanPlate.length < 5) {
      setVerifyError("Vui lòng nhập biển số hợp lệ");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setVerifyError("Số điện thoại không hợp lệ");
      return;
    }

    setLoading(true);
    const result = await rewardService.verifyIdentity(token, cleanPlate, cleanPhone);
    if (!result.verified) {
      setVerifyError(result.message);
      setLoading(false);
      return;
    }
    setStep("capture");
    setLoading(false);
  };

  // Photo capture + OCR
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // Attempt OCR with Puter Server Action
    setOcrLoading(true);
    setOcrError("");
    try {
      // Downsize image first to avoid "payload too large" (max 10MB base64)
      const { downsizeImage } = await import("@/lib/imageUtils");
      const smallFile = await downsizeImage(file);
      
      const { performOcr } = await import("@/app/services/ocrAction");
      const formData = new FormData();
      formData.append("file", smallFile);

      const result = await performOcr(formData);

      if (result.success && (result.full_name || result.id_number)) {
        if (result.full_name) setIdName(result.full_name);
        if (result.id_number) setIdNumber(result.id_number);
        setIsOcrVerified(true);
      } else {
        setOcrError(result.message || "AI không thể đọc được thông tin. Vui lòng nhập tay.");
        setIsOcrVerified(false);
      }
    } catch (err) {
      setOcrError("Không thể kết nối dịch vụ AI. Vui lòng nhập tay.");
      setIsOcrVerified(false);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleGoToReview = () => {
    if (!photoFile) {
      alert("Vui lòng chụp ảnh CCCD.");
      return;
    }
    if (!idName.trim() || !idNumber.trim()) {
      alert("Vui lòng nhập họ tên và số CCCD.");
      return;
    }
    setStep("review");
  };

  // Submit
  const handleSubmit = async () => {
    if (!consent) {
      alert("Vui lòng đồng ý với điều khoản bảo mật.");
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      // Upload photo
      const storagePath = await rewardService.uploadIdPhoto(
        photoFile!,
        reward!.license_plate,
        reward!.month,
        reward!.year
      );

      // Submit claim
      const result = await rewardService.submitRewardClaim({
        token,
        id_full_name: idName,
        id_number: idNumber,
        id_card_photo_url: storagePath,
        is_ocr_verified: isOcrVerified,
      });

      if (result.success) {
        setStep("done");
      } else {
        setMessage(result.message);
        setStep("error");
      }
    } catch (err) {
      console.error("Lỗi gửi:", err);
      setMessage("Có lỗi xảy ra. Vui lòng thử lại.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Zap size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Vision Energy</h1>
            <p className="text-sm opacity-80">Chương trình thưởng khách hàng</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Step Indicator */}
        {step !== "error" && step !== "done" && (
          <div className="flex items-center justify-center gap-2">
            {[
              { key: "verify", label: "Xác minh" },
              { key: "capture", label: "Chụp CCCD" },
              { key: "review", label: "Xác nhận" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step === s.key
                      ? "bg-primary text-primary-foreground"
                      : ["verify", "capture", "review"].indexOf(step) > i
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {["verify", "capture", "review"].indexOf(step) > i ? (
                    <CheckCircle size={16} />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && <ChevronRight size={14} className="text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Identity Verification */}
        {step === "verify" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserCheck size={28} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Xác minh danh tính</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Nhập thông tin để xác nhận bạn là chủ tài khoản
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={plate}
                  onChange={handlePlateChange}
                  placeholder="VD: 51F02942"
                  className="admin-input text-center font-mono text-lg tracking-wider uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="VD: 0901 234 567"
                  className="admin-input text-center text-lg tracking-wider"
                />
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  {verifyError}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : "Xác minh"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Camera Capture + OCR */}
        {step === "capture" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera size={28} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Chụp ảnh CCCD</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Chụp mặt trước Căn Cước Công Dân của bạn
              </p>
            </div>

            {/* Camera Input */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="CCCD Preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
              ) : (
                <div className="space-y-2">
                  <Camera size={40} className="mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nhấn để chụp ảnh</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {/* OCR Status */}
            {ocrLoading && (
              <div className="flex items-center gap-2 text-primary bg-primary/10 p-3 rounded-lg text-sm">
                <Loader2 size={16} className="animate-spin" />
                Đang xử lý ảnh bằng AI...
              </div>
            )}

            {isOcrVerified && (
              <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg text-sm">
                <CheckCircle size={16} />
                AI đã nhận diện thông tin thành công!
              </div>
            )}

            {ocrError && !ocrLoading && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg text-sm">
                <AlertCircle size={16} />
                {ocrError}
              </div>
            )}

            {/* Manual/Auto-filled fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Họ và tên (trên CCCD) {isOcrVerified && <span className="text-green-500 text-xs">✓ AI</span>}
                </label>
                <input
                  type="text"
                  value={idName}
                  onChange={(e) => setIdName(e.target.value)}
                  placeholder="VD: NGUYỄN VĂN A"
                  className="admin-input uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Số CCCD {isOcrVerified && <span className="text-green-500 text-xs">✓ AI</span>}
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="VD: 079123456789"
                  className="admin-input font-mono tracking-wider"
                />
              </div>
            </div>

            <button
              onClick={handleGoToReview}
              disabled={!photoFile || !idName.trim() || !idNumber.trim()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {/* Step 3: Review & Consent */}
        {step === "review" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText size={28} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Xác nhận thông tin</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vui lòng kiểm tra lại trước khi gửi
              </p>
            </div>

            {/* Review Info */}
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Họ tên</span>
                <span className="text-sm font-medium text-foreground">{idName}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Số CCCD</span>
                <span className="text-sm font-mono font-medium text-foreground">{idNumber}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">OCR</span>
                <span className={`text-sm font-medium ${isOcrVerified ? "text-green-500" : "text-yellow-500"}`}>
                  {isOcrVerified ? "✓ Đã xác thực AI" : "Nhập thủ công"}
                </span>
              </div>
              {photoPreview && (
                <img src={photoPreview} alt="CCCD" className="w-full rounded-lg object-contain max-h-40" />
              )}
            </div>

            {/* Privacy Consent */}
            <label className="flex items-start gap-3 p-3 bg-muted rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <div className="text-xs text-muted-foreground">
                <Lock size={12} className="inline mr-1" />
                Tôi đồng ý cung cấp thông tin cá nhân cho chương trình thưởng. Dữ liệu sẽ được bảo mật
                và chỉ sử dụng cho mục đích xác minh nhận thưởng.
              </div>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("capture")}
                className="flex-1 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={handleSubmit}
                disabled={!consent || submitting}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : "Gửi thông tin"}
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {step === "done" && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Gửi thành công!</h2>
            <p className="text-muted-foreground text-sm">
              Thông tin của bạn đã được gửi đến quản trị viên. Bạn sẽ được thông báo khi phần thưởng được duyệt.
            </p>
          </div>
        )}

        {/* Error / Already Submitted */}
        {step === "error" && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={36} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {reward?.status === "processing" || reward?.status === "completed"
                ? "Đã gửi thông tin"
                : "Không thể truy cập"}
            </h2>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield size={12} />
            Dữ liệu được bảo mật bởi Vision Energy
          </div>
        </div>
      </div>
    </div>
  );
}
