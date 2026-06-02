/**
 * Vietnamese UI strings for RITA Adobe.
 *
 * The application is Vietnamese-first (single language). Centralizing the copy
 * here keeps wording consistent and makes it easy to adjust. API responses are
 * already returned in Vietnamese by the ADES backend and are surfaced as-is.
 */
export const vi = {
  app: {
    name: 'RITA Adobe',
    tagline: 'Bảng điều khiển hỗ trợ nội bộ ADES',
  },
  theme: {
    toLight: 'Chuyển sang giao diện sáng',
    toDark: 'Chuyển sang giao diện tối',
  },
  email: {
    label: 'Địa chỉ email',
    placeholder: 'Nhập email tài khoản cần tra cứu',
    required: 'Vui lòng nhập địa chỉ email.',
    invalid: 'Địa chỉ email không hợp lệ.',
    tooLong: 'Email vượt quá độ dài tối đa cho phép.',
  },
  actions: {
    checkStatus: 'Kiểm tra trạng thái',
    view12h: 'Dữ liệu 12 giờ',
    getVariables: 'Lấy biến dữ liệu',
    reinvite: 'Mời lại',
    readOtp: 'Đọc mã OTP',
    startMonitoring: 'Bắt đầu theo dõi',
    disconnect: 'Ngắt kết nối',
    retry: 'Thử lại',
    copy: 'Sao chép',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
  },
  panels: {
    accountStatus: 'Trạng thái tài khoản',
    account12h: 'Dữ liệu 12 giờ',
    variables: 'Biến dữ liệu',
    reinvite: 'Trạng thái mời lại',
    otp: 'Mã OTP',
    monitoring: 'Theo dõi thời gian thực',
  },
  empty: {
    accountStatus: 'Chưa có dữ liệu trạng thái tài khoản.',
    account12h: 'Không có hoạt động nào trong 12 giờ qua.',
    variables: 'Không có biến dữ liệu cho email này.',
    otp: 'Không tìm thấy mã OTP cho email này.',
    monitoring: 'Chưa có tin nhắn nào.',
    initial: 'Nhập email và chọn một thao tác để bắt đầu.',
  },
  status: {
    idle: 'Chưa thực hiện',
    loading: 'Đang tải…',
    connected: 'Đã kết nối',
    connecting: 'Đang kết nối…',
    disconnected: 'Đã ngắt kết nối',
    error: 'Lỗi kết nối',
  },
  toast: {
    checkStatusOk: 'Đã kiểm tra trạng thái tài khoản.',
    checkStatusFail: 'Kiểm tra trạng thái thất bại',
    view12hOk: 'Đã lấy dữ liệu 12 giờ.',
    view12hFail: 'Lấy dữ liệu 12 giờ thất bại',
    variablesOk: 'Đã lấy biến dữ liệu.',
    variablesFail: 'Lấy biến dữ liệu thất bại',
    reinviteOk: 'Đã gửi lời mời lại.',
    reinviteFail: 'Gửi lời mời lại thất bại',
    otpOk: 'Đã đọc mã OTP.',
    otpFail: 'Đọc mã OTP thất bại',
    otpCopied: 'Đã sao chép mã OTP.',
    otpCopyFail: 'Không sao chép được mã OTP. Vui lòng sao chép thủ công.',
    monitorTimeout: 'Kết nối quá thời gian chờ. Nhấn "Thử lại" để kết nối lại.',
    monitorError: 'Lỗi kết nối WebSocket. Nhấn "Thử lại" để kết nối lại.',
    monitorClosed: 'Máy chủ đã đóng kết nối theo dõi.',
    unknownError: 'Đã xảy ra lỗi không xác định.',
  },
  reinviteDialog: {
    title: 'Xác nhận mời lại',
    message: (email: string) => `Gửi lời mời lại tới ${email}?`,
    confirm: 'Gửi lời mời',
    cancel: 'Hủy',
  },
  monitor: {
    messages: 'tin nhắn',
    timestampHeader: 'Thời gian',
    contentHeader: 'Nội dung',
  },
  viewport: {
    desktopOnly:
      'RITA Adobe được tối ưu cho màn hình máy tính từ 1024 pixel trở lên. Vui lòng mở rộng cửa sổ hoặc dùng màn hình lớn hơn.',
  },
} as const;

export type ViStrings = typeof vi;
