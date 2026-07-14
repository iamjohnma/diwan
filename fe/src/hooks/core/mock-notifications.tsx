import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react';

export type MockNotificationType =
  | 'case_updated'
  | 'hearing_reminder'
  | 'payment_received'
  | 'document_uploaded'
  | 'party_added'
  | 'installment_due';

export interface MockNotification {
  id: string;
  type: MockNotificationType;
  title: string;
  body: string;
  createdAt: number;
  isRead: boolean;
}

interface MockNotificationsContextValue {
  notifications: MockNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const MockNotificationsContext =
  createContext<MockNotificationsContextValue | null>(null);

const NOW = Date.now();

const INITIAL_MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'n1',
    type: 'hearing_reminder',
    title: 'تذكير بجلسة قادمة',
    body: 'جلسة القضية رقم 2024/118 غداً الساعة 10:00 صباحاً في محكمة الصلح.',
    createdAt: NOW - 1000 * 60 * 12,
    isRead: false
  },
  {
    id: 'n2',
    type: 'payment_received',
    title: 'تم استلام دفعة',
    body: 'تم تسجيل دفعة بمبلغ ₪1,500 من الموكل أحمد منصور.',
    createdAt: NOW - 1000 * 60 * 45,
    isRead: false
  },
  {
    id: 'n3',
    type: 'document_uploaded',
    title: 'مستند جديد',
    body: 'تم رفع عقد الوكالة إلى ملف القضية التجارية 2023/87.',
    createdAt: NOW - 1000 * 60 * 60 * 3,
    isRead: false
  },
  {
    id: 'n4',
    type: 'case_updated',
    title: 'تحديث على القضية',
    body: 'تم تغيير حالة القضية رقم 2025/14 إلى "قيد المتابعة".',
    createdAt: NOW - 1000 * 60 * 60 * 8,
    isRead: true
  },
  {
    id: 'n5',
    type: 'party_added',
    title: 'طرف جديد',
    body: 'تمت إضافة الخصم شركة النور للتطوير إلى ملف القضية.',
    createdAt: NOW - 1000 * 60 * 60 * 26,
    isRead: true
  },
  {
    id: 'n6',
    type: 'installment_due',
    title: 'قسط مستحق قريباً',
    body: 'القسط الثالث بمبلغ ₪800 يستحق خلال يومين.',
    createdAt: NOW - 1000 * 60 * 60 * 40,
    isRead: true
  }
];

export function MockNotificationsProvider(props: { children: ReactNode }) {
  const [notifications, setNotifications] = useState(INITIAL_MOCK_NOTIFICATIONS);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.isRead ? notification : { ...notification, isRead: true }
      )
    );
  }, []);

  const value = useMemo<MockNotificationsContextValue>(() => {
    const unreadCount = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    return {
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead
    };
  }, [markAllAsRead, markAsRead, notifications]);

  return (
    <MockNotificationsContext.Provider value={value}>
      {props.children}
    </MockNotificationsContext.Provider>
  );
}

export function useMockNotifications(): MockNotificationsContextValue {
  const context = useContext(MockNotificationsContext);
  if (!context) {
    throw new Error(
      'useMockNotifications must be used within MockNotificationsProvider'
    );
  }

  return context;
}

export function useGetUnreadNotificationsCount(): { data: number } {
  const { unreadCount } = useMockNotifications();

  return { data: unreadCount };
}
