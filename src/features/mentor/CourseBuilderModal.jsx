import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  BookOpen,
  Plus,
  Trash2,
  Video,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  FileCheck,
  Send,
  Layers
} from 'lucide-react';

export function CourseBuilderModal({ isOpen, onClose, currentUser, existingCourse, onCourseSaved }) {
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'curriculum' | 'pricing' | 'preview'

  // Basic Information
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop&q=80');
  const [category, setCategory] = useState('Conversational Fluency');
  const [difficultyLevel, setDifficultyLevel] = useState('Intermediate');