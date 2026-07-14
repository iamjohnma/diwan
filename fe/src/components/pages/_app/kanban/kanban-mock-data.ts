import type { Icon } from '@phosphor-icons/react';
import {
  AlarmIcon,
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  ChatCircleIcon,
  MapPinIcon,
  PhoneCallIcon,
  SpiralIcon,
  TagIcon
} from '@phosphor-icons/react';

/** Mock UI copy — this view is not wired to i18n yet. */
export const KANBAN_LABELS = {
  boardTitle: 'طلبات التصميم',
  addTask: 'إضافة مهمة'
} as const;

export interface KanbanTaskMeta {
  id: string;
  icon: Icon;
  /** Icon-only meta items (e.g. the repeat marker) use an empty label. */
  label: string;
  colorClassName?: string;
}

export interface KanbanAssignee {
  name: string;
  avatarUrl?: string;
  colorClassName: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  /** Renders the checkbox circle in red, like a high-priority task. */
  isPriority?: boolean;
  assignee?: KanbanAssignee;
  meta?: KanbanTaskMeta[];
}

export interface KanbanLaneData {
  id: string;
  title: string;
  tasks: KanbanTask[];
}

export const KANBAN_LANES: KanbanLaneData[] = [
  {
    id: 'todo',
    title: 'قيد الانتظار',
    tasks: [
      {
        id: 'redesign-proposal',
        title: 'إرسال مقترح إعادة التصميم',
        assignee: {
          name: 'نادية كريم',
          avatarUrl: 'https://i.pravatar.cc/48?img=47',
          colorClassName: 'bg-neutral-800'
        },
        meta: [
          { id: 'calls', icon: PhoneCallIcon, label: '0/1' },
          {
            id: 'due',
            icon: CalendarBlankIcon,
            label: 'اليوم 17:00',
            colorClassName: 'text-emerald-600'
          },
          {
            id: 'repeat',
            icon: ArrowsClockwiseIcon,
            label: '',
            colorClassName: 'text-emerald-600'
          },
          { id: 'reminders', icon: AlarmIcon, label: '2' },
          { id: 'location', icon: MapPinIcon, label: '' },
          { id: 'comments', icon: ChatCircleIcon, label: '2' }
        ]
      },
      {
        id: 'speed-improvements',
        title: 'تحسينات السرعة'
      }
    ]
  },
  {
    id: 'this-week',
    title: 'هذا الأسبوع',
    tasks: [
      {
        id: 'social-visuals',
        title: 'تصميم مرئيات جديدة لصفحات التواصل',
        description:
          'تصميم وإنتاج مرئيات جديدة لحسابات الشركة على منصات التواصل…',
        isPriority: true,
        meta: [
          {
            id: 'due',
            icon: CalendarBlankIcon,
            label: 'السبت',
            colorClassName: 'text-violet-600'
          },
          { id: 'span', icon: SpiralIcon, label: '21 فبراير' },
          { id: 'tag', icon: TagIcon, label: 'طلب-تصميم' }
        ]
      },
      {
        id: 'sidebar-navigation',
        title: 'تحسين التنقل عبر الشريط الجانبي',
        assignee: { name: 'آدم صلاح', colorClassName: 'bg-blue-500' }
      },
      {
        id: 'onboarding-flow',
        title: 'تجربة تأهيل جديدة للمستخدمين',
        assignee: {
          name: 'نادية كريم',
          avatarUrl: 'https://i.pravatar.cc/48?img=47',
          colorClassName: 'bg-neutral-800'
        }
      }
    ]
  },
  {
    id: 'review',
    title: 'مراجعة',
    tasks: [
      {
        id: 'drag-drop-reordering',
        title: 'إعادة الترتيب بالسحب والإفلات'
      }
    ]
  }
];
