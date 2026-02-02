import { Reservation } from '@/types/reservation';
import { formatTimestamp } from '@/utils/date';

export const formatGender = (gender?: string) =>
  gender === 'male' ? '男性' : gender === 'female' ? '女性' : '不明';

export const getAgeGroup = (birthdate?: string) => {
  if (!birthdate) return '不明';
  const birthYear = new Date(birthdate).getFullYear();
  if (!Number.isFinite(birthYear)) return '不明';
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return '不明';
  if (age < 30) return '20代';
  if (age < 40) return '30代';
  if (age < 50) return '40代';
  if (age < 60) return '50代';
  return '60代以上';
};

export const getReservationType = (reservation: { slowRoomAsSetPlan?: boolean }) =>
  reservation.slowRoomAsSetPlan ? 'セットプラン' : 'サウナ単体';

export const buildReservationExportRows = (
  reservations: Reservation[],
  roomTypeNames: Record<string, string>
) => {
  return reservations.map((reservation) => {
    const displayDate = reservation.displayDate || reservation.reservationDate || '';
    const displayTime = reservation.displayTimeRange || reservation.reservationTime || '';
    const slowRoomTime = reservation.displaySlowRoomTimeRange || '';
    const roomTypeLabel = roomTypeNames[reservation.roomType] || reservation.roomType;
    const amount = parseInt(String(reservation.price), 10);
    const amountLabel = Number.isFinite(amount) ? `¥${amount.toLocaleString()}` : '';
    const statusLabel =
      reservation.paymentStatus === 'paid'
        ? '支払い済み'
        : reservation.paymentStatus === 'cancelled'
        ? 'キャンセル'
        : reservation.paymentStatus;

    return [
      reservation.id,
      formatTimestamp(reservation.createdAt, 'yyyy/MM/dd HH:mm'),
      reservation.userFullName || '未設定',
      reservation.userEmail || '',
      reservation.userPhone || '',
      displayDate,
      displayTime,
      slowRoomTime,
      roomTypeLabel,
      getReservationType(reservation),
      amountLabel,
      statusLabel,
      formatGender(reservation.userGender),
      getAgeGroup(reservation.userBirthdate)
    ];
  });
};
