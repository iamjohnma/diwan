import type {
  CalendarDoctor,
  CalendarEvent,
  CalendarUser
} from '@/@types/common/big-calendar';

export const MOCK_CALENDAR_LAWYERS: CalendarDoctor[] = [
  {
    id: 'lawyer-omar',
    name: 'عمر الحرباوي',
    avatar: null,
    specialty: 'قضايا مدنية وتجارية',
    color: '#d03f3f'
  },
  {
    id: 'lawyer-lina',
    name: 'لينا الخطيب',
    avatar: null,
    specialty: 'قضايا الشركات',
    color: '#5b7c99'
  },
  {
    id: 'lawyer-samer',
    name: 'سامر منصور',
    avatar: null,
    specialty: 'التنفيذ والتحصيل',
    color: '#8a6c49'
  },
  {
    id: 'lawyer-nour',
    name: 'نور أبو عيشة',
    avatar: null,
    specialty: 'الأحوال الشخصية',
    color: '#497b70'
  }
];

export const MOCK_CALENDAR_USERS: CalendarUser[] = MOCK_CALENDAR_LAWYERS.map(
  (lawyer) => ({
    id: lawyer.id,
    name: lawyer.name,
    picturePath: lawyer.avatar
  })
);

function dateAt(
  dayOffset: number,
  hour: number,
  minute: number,
  durationMinutes: number
) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function mockEvent(
  id: string,
  dayOffset: number,
  hour: number,
  minute: number,
  durationMinutes: number,
  details: Omit<CalendarEvent, 'id' | 'startDate' | 'endDate' | 'user'> & {
    dentistId: string;
  }
): CalendarEvent {
  const lawyer =
    MOCK_CALENDAR_LAWYERS.find(
      (candidate) => candidate.id === details.dentistId
    ) ?? MOCK_CALENDAR_LAWYERS[0];

  if (!lawyer) throw new Error('Mock calendar requires at least one lawyer.');

  return {
    id,
    ...dateAt(dayOffset, hour, minute, durationMinutes),
    ...details,
    user: { id: lawyer.id, name: lawyer.name, picturePath: lawyer.avatar }
  };
}

export function buildMockCalendarEvents(): CalendarEvent[] {
  return [
    mockEvent('hearing-118', 0, 9, 0, 60, {
      patientName: 'شركة النور للتجارة',
      title: 'جلسة مرافعة — القضية 2025/118',
      visitType: 'جلسة محكمة',
      color: 'blue',
      description: 'محكمة الاستئناف — القاعة 3',
      dentistId: 'lawyer-omar',
      branchId: 'ramallah',
      status: 'scheduled'
    }),
    mockEvent('consultation-77', 0, 10, 30, 45, {
      patientName: 'محمد عبد الله الحربي',
      title: 'اجتماع تحضيري — القضية 2025/077',
      visitType: 'اجتماع موكل',
      color: 'green',
      description: 'مراجعة البينات قبل الجلسة القادمة',
      dentistId: 'lawyer-lina',
      branchId: 'ramallah',
      status: 'confirmed',
      patientArrived: true
    }),
    mockEvent('filing-32', 0, 12, 0, 30, {
      patientName: 'مؤسسة الأمانة للمقاولات',
      title: 'مهلة إيداع مذكرة',
      visitType: 'موعد إجرائي',
      color: 'yellow',
      description: 'آخر موعد لإيداع المذكرة الجوابية',
      dentistId: 'lawyer-samer',
      branchId: 'nablus',
      status: 'pending'
    }),
    mockEvent('family-41', 0, 13, 30, 60, {
      patientName: 'سارة أحمد القحطاني',
      title: 'جلسة تسوية أسرية',
      visitType: 'جلسة محكمة',
      color: 'purple',
      description: 'محكمة رام الله الشرعية',
      dentistId: 'lawyer-nour',
      branchId: 'ramallah',
      status: 'scheduled'
    }),
    mockEvent('late-review', 0, 15, 0, 45, {
      patientName: 'أحمد مصطفى سليمان',
      title: 'مراجعة ملف التنفيذ 8821',
      visitType: 'مراجعة داخلية',
      color: 'gray',
      description: 'تحديث حساب المبالغ المحصلة',
      dentistId: 'lawyer-samer',
      branchId: 'nablus',
      status: 'scheduled',
      isLate: true
    }),
    mockEvent('tomorrow-court', 1, 8, 30, 90, {
      patientName: 'شركة الشرق للتأمين',
      title: 'سماع شاهد — القضية 2025/061',
      visitType: 'جلسة محكمة',
      color: 'orange',
      description: 'محكمة بداية نابلس',
      dentistId: 'lawyer-lina',
      branchId: 'nablus',
      status: 'confirmed'
    }),
    mockEvent('tomorrow-client', 1, 11, 0, 45, {
      patientName: 'خالد يوسف عوض',
      title: 'توقيع وكالة خاصة',
      visitType: 'اجتماع موكل',
      color: 'green',
      description: 'إحضار الهوية الأصلية',
      dentistId: 'lawyer-omar',
      branchId: 'ramallah',
      status: 'scheduled'
    }),
    mockEvent('next-week', 3, 10, 0, 60, {
      patientName: 'جمعية الندى الخيرية',
      title: 'اجتماع مجلس الإدارة',
      visitType: 'استشارة شركات',
      color: 'blue',
      description: 'مراجعة تعديلات النظام الداخلي',
      dentistId: 'lawyer-lina',
      branchId: 'ramallah',
      status: 'scheduled'
    }),
    mockEvent('past-hearing', -2, 14, 0, 45, {
      patientName: 'يوسف محمود دويكات',
      title: 'جلسة تنفيذ — الملف 4432',
      visitType: 'جلسة محكمة',
      color: 'red',
      description: 'تم تأجيل الجلسة لتبليغ المحكوم عليه',
      dentistId: 'lawyer-samer',
      branchId: 'nablus',
      status: 'completed',
      patientArrived: true
    })
  ];
}

export const MOCK_CALENDAR_BRANCHES = [
  { id: 'ramallah', name: 'مكتب رام الله' },
  { id: 'nablus', name: 'مكتب نابلس' }
] as const;
