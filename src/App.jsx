import React, { useState, useEffect, useRef } from 'react';
import { Plus, BookOpen, CheckCircle, Circle, Edit2, Trash2, Award, Calendar, FileText, AlertCircle, Check, X, GripVertical, Database } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import {
  CSS
} from '@dnd-kit/utilities';
import { saveSubjects, saveDismissedRevisions, loadUserData } from './services/firebaseService';
import { createBackup } from './services/backupService';
import BackupRestore from './components/BackupRestore';

const StudyTracker = () => {
  const [subjects, setSubjects] = useState([]);
  const [currentView, setCurrentView] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [newPaper, setNewPaper] = useState({
    session: 'MJ',
    year: new Date().getFullYear(),
    paperNumber: 1,
    score: '',
    hardChapters: ''
  });
  
  // New states for calendar view
  const [calendarView, setCalendarView] = useState('chapters');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dismissedRevisions, setDismissedRevisions] = useState(new Set());
  const [showDayEditModal, setShowDayEditModal] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [showBackupRestore, setShowBackupRestore] = useState(false);

  // Load data from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await loadUserData();
        setSubjects(userData.subjects);
        setDismissedRevisions(userData.dismissedRevisions);

      } catch (error) {
        console.error('Failed to load data from Firebase:', error);
        // Fallback to localStorage if Firebase fails
        const savedSubjects = localStorage.getItem('studyTrackerSubjects');
        if (savedSubjects) {
          setSubjects(JSON.parse(savedSubjects));
        }

        const savedDismissedRevisions = localStorage.getItem('studyTrackerDismissedRevisions');
        if (savedDismissedRevisions) {
          setDismissedRevisions(new Set(JSON.parse(savedDismissedRevisions)));
        }
      }
    };

    loadData();
  }, []);

  // Save data to Firebase whenever subjects change
  useEffect(() => {
    if (subjects.length > 0) {
      saveSubjects(subjects).catch(error => {
        console.error('Failed to save subjects to Firebase:', error);
        // Fallback to localStorage
        localStorage.setItem('studyTrackerSubjects', JSON.stringify(subjects));
      });
    }
  }, [subjects]);

  // Save dismissed revisions to Firebase
  useEffect(() => {
    if (dismissedRevisions.size > 0) {
      saveDismissedRevisions(dismissedRevisions).catch(error => {
        console.error('Failed to save dismissed revisions to Firebase:', error);
        // Fallback to localStorage
        localStorage.setItem('studyTrackerDismissedRevisions', JSON.stringify(Array.from(dismissedRevisions)));
      });
    }
  }, [dismissedRevisions]);

  // Helper function to dismiss current overdue warnings permanently
  const dismissOverdueWarning = async () => {
    if (!selectedSubject) return;

    // Create backup before dismissing overdue warnings
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'dismiss-overdue',
        subject: selectedSubject.name,
        description: `Before dismissing overdue revision warnings for ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before dismissing overdue warnings:', error);
    }

    // Get all currently overdue revisions and mark them as dismissed
    const currentOverdueRevisions = getOverdueRevisions();
    const newDismissedRevisions = new Set(dismissedRevisions);

    currentOverdueRevisions.forEach(revision => {
      const revisionId = `${revision.sessionId}-${revision.revisionIndex}`;
      newDismissedRevisions.add(revisionId);
    });

    setDismissedRevisions(newDismissedRevisions);
  };

  // Get overdue revisions that haven't been dismissed
  const getNonDismissedOverdueRevisions = () => {
    if (!selectedSubject || !selectedSubject.studySessions) return [];
    
    const allOverdueRevisions = getOverdueRevisions();
    return allOverdueRevisions.filter(revision => {
      const revisionId = `${revision.sessionId}-${revision.revisionIndex}`;
      return !dismissedRevisions.has(revisionId);
    });
  };

  // Check if overdue warning should be shown for current subject
  const shouldShowOverdueWarning = () => {
    return getNonDismissedOverdueRevisions().length > 0;
  };

  // Helper function to calculate revision dates
  const calculateRevisionDates = (studyDate) => {
    const date = new Date(studyDate);
    const revisions = [
      { days: 3, completed: false },
      { days: 7, completed: false },
      { days: 14, completed: false },
      { days: 30, completed: false }
    ];

    return revisions.map((rev, index) => {
      const revisionDate = new Date(date);
      revisionDate.setDate(revisionDate.getDate() + rev.days);
      return {
        id: `rev-${index}`,
        date: revisionDate.toISOString().split('T')[0],
        cycle: `Day ${rev.days}`,
        completed: rev.completed
      };
    });
  };

  // Add study session to calendar
  const addStudySession = async (chapterName, date) => {
    if (!selectedSubject || !chapterName) return;

    // Create backup before adding study session
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'add-study-session',
        target: chapterName,
        subject: selectedSubject.name,
        date: date,
        description: `Before adding study session: ${chapterName} on ${date} for ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before adding study session:', error);
    }

    const studySession = {
      id: Date.now(),
      chapterName,
      studyDate: date,
      revisions: calculateRevisionDates(date),
      lastRevisionCompleted: -1 // Track which revision cycle we're on
    };

    const updatedSubjects = subjects.map(subject =>
      subject.id === selectedSubject.id
        ? {
            ...subject,
            studySessions: [...(subject.studySessions || []), studySession]
          }
        : subject
    );

    setSubjects(updatedSubjects);
    setSelectedSubject({
      ...selectedSubject,
      studySessions: [...(selectedSubject.studySessions || []), studySession]
    });
  };

  // Handle clicking on a calendar day
  const handleDayClick = (day) => {
    if (!day) return;
    
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = getEventsForDate(day);
    
    setSelectedDayData({
      date: dateStr,
      dayNumber: day,
      ...events
    });
    setShowDayEditModal(true);
  };

  // Mark revision as completed
  const toggleRevisionComplete = async (sessionId, revisionIndex) => {
    // First, find the current session to check its state
    const currentSession = selectedSubject.studySessions.find(s => s.id === sessionId);
    if (!currentSession) return;

    const isCompleting = !currentSession.revisions[revisionIndex].completed;
    const revision = currentSession.revisions[revisionIndex];

    // Create backup before toggling revision completion
    try {
      const userData = { subjects, dismissedRevisions };
      const action = isCompleting ? 'complete-revision' : 'reset-revision';
      await createBackup(userData, {
        type: 'change',
        action: action,
        target: currentSession.chapterName,
        subject: selectedSubject.name,
        cycle: revision.cycle,
        description: `Before ${isCompleting ? 'completing' : 'resetting'} revision: ${currentSession.chapterName} - ${revision.cycle} for ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before toggling revision completion:', error);
    }

    const updatedSubjects = subjects.map(subject =>
      subject.id === selectedSubject.id
        ? {
            ...subject,
            studySessions: subject.studySessions.map(session =>
              session.id === sessionId
                ? {
                    ...session,
                    revisions: session.revisions.map((rev, idx) =>
                      idx === revisionIndex
                        ? { ...rev, completed: !rev.completed }
                        : rev
                    ),
                    lastRevisionCompleted: revisionIndex
                  }
                : session
            )
          }
        : subject
    );

    setSubjects(updatedSubjects);

    const updatedSelectedSubject = {
      ...selectedSubject,
      studySessions: selectedSubject.studySessions.map(session =>
        session.id === sessionId
          ? {
              ...session,
              revisions: session.revisions.map((rev, idx) =>
                idx === revisionIndex
                  ? { ...rev, completed: !rev.completed }
                  : rev
              ),
              lastRevisionCompleted: revisionIndex
            }
          : session
      )
    };

    setSelectedSubject(updatedSelectedSubject);

    // If completing a revision, remove it from dismissed revisions
    if (isCompleting) {
      const revisionId = `${sessionId}-${revisionIndex}`;
      const newDismissedRevisions = new Set(dismissedRevisions);
      newDismissedRevisions.delete(revisionId);
      setDismissedRevisions(newDismissedRevisions);
    }

    // Check if we're completing the last revision and need to add maintenance
    if (isCompleting && currentSession && revisionIndex === currentSession.revisions.length - 1) {
      // Add a new maintenance revision 30 days from this revision's date
      const lastRevisionDate = new Date(currentSession.revisions[revisionIndex].date);
      const maintenanceDate = new Date(lastRevisionDate);
      maintenanceDate.setDate(maintenanceDate.getDate() + 30);

      const newRevision = {
        id: `rev-${currentSession.revisions.length}`,
        date: maintenanceDate.toISOString().split('T')[0],
        cycle: 'Maintenance (30 days)',
        completed: false
      };

      // Update again with the new maintenance revision
      const finalUpdatedSubjects = subjects.map(subject => {
        if (subject.id === selectedSubject.id) {
          return {
            ...subject,
            studySessions: subject.studySessions.map(session => {
              if (session.id === sessionId) {
                return {
                  ...session,
                  revisions: [...session.revisions, newRevision]
                };
              }
              return session;
            })
          };
        }
        return subject;
      });

      setSubjects(finalUpdatedSubjects);

      // Update selected subject with new maintenance revision
      const finalSelectedSubject = finalUpdatedSubjects.find(s => s.id === selectedSubject.id);
      setSelectedSubject(finalSelectedSubject);
    }
  };

  // Get revisions due today
  const getRevisionsForToday = () => {
    if (!selectedSubject || !selectedSubject.studySessions) return [];
    
    const today = new Date().toISOString().split('T')[0];
    const revisions = [];

    selectedSubject.studySessions.forEach(session => {
      session.revisions.forEach((revision, index) => {
        if (revision.date === today) {
          revisions.push({
            sessionId: session.id,
            chapterName: session.chapterName,
            studyDate: session.studyDate,
            revisionIndex: index,
            cycle: revision.cycle,
            completed: revision.completed
          });
        }
      });
    });

    return revisions;
  };

  // Get all overdue revisions
  const getOverdueRevisions = () => {
    if (!selectedSubject || !selectedSubject.studySessions) return [];
    
    const today = new Date().toISOString().split('T')[0];
    const overdueRevisions = [];

    selectedSubject.studySessions.forEach(session => {
      session.revisions.forEach((revision, index) => {
        if (revision.date < today && !revision.completed) {
          overdueRevisions.push({
            sessionId: session.id,
            chapterName: session.chapterName,
            studyDate: session.studyDate,
            revisionIndex: index,
            cycle: revision.cycle,
            dueDate: revision.date
          });
        }
      });
    });

    return overdueRevisions;
  };

  // Delete study session
  const deleteStudySession = async (sessionId) => {
    const sessionToDelete = selectedSubject.studySessions?.find(s => s.id === sessionId);
    if (!sessionToDelete) return;

    // Create backup before deleting study session
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'delete-study-session',
        target: sessionToDelete.chapterName,
        subject: selectedSubject.name,
        date: sessionToDelete.studyDate,
        description: `Before deleting study session: ${sessionToDelete.chapterName} on ${sessionToDelete.studyDate} for ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before deleting study session:', error);
    }

    const updatedSubjects = subjects.map(subject =>
      subject.id === selectedSubject.id
        ? {
            ...subject,
            studySessions: subject.studySessions.filter(session => session.id !== sessionId)
          }
        : subject
    );

    setSubjects(updatedSubjects);
    setSelectedSubject({
      ...selectedSubject,
      studySessions: selectedSubject.studySessions.filter(session => session.id !== sessionId)
    });
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getEventsForDate = (day) => {
    if (!selectedSubject || !selectedSubject.studySessions || !day) return { studies: [], revisions: [] };

    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const studies = [];
    const revisions = [];

    selectedSubject.studySessions.forEach(session => {
      if (session.studyDate === dateStr) {
        studies.push(session);
      }
      
      session.revisions.forEach((revision, index) => {
        if (revision.date === dateStr) {
          revisions.push({
            ...revision,
            sessionId: session.id,
            chapterName: session.chapterName,
            revisionIndex: index
          });
        }
      });
    });

    return { studies, revisions };
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  // Sortable chapter component
  const SortableChapter = ({ chapter }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: chapter.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
      >
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical size={16} />
        </div>
        <button
          onClick={() => toggleChapterCompletion(chapter.id)}
          className="text-blue-500 hover:text-blue-700 transition-colors"
        >
          {chapter.topicalsCompleted ? 
            <CheckCircle size={20} className="text-green-500" /> : 
            <Circle size={20} />
          }
        </button>
        <span className={`flex-1 ${chapter.topicalsCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
          {chapter.name}
        </span>
        <span className="text-sm text-gray-500 mr-2">
          {chapter.topicalsCompleted ? 'Completed' : 'Pending'}
        </span>
        <button
          onClick={() => deleteChapter(chapter.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const addSubject = async () => {
    if (newSubjectName.trim()) {
      // Create backup before adding subject
      try {
        const userData = { subjects, dismissedRevisions };
        await createBackup(userData, {
          type: 'change',
          action: 'add-subject',
          target: newSubjectName.trim(),
          description: `Before adding subject: ${newSubjectName.trim()}`
        });
      } catch (error) {
        console.error('Failed to create backup before adding subject:', error);
      }

      const newSubject = {
        id: Date.now(),
        name: newSubjectName.trim(),
        chapters: [],
        pastPapers: [],
        studySessions: [] // Add this for calendar functionality
      };
      setSubjects([...subjects, newSubject]);
      setNewSubjectName('');
      setShowAddSubject(false);
    }
  };

  const deleteSubject = async (subjectId) => {
    const subjectToDelete = subjects.find(s => s.id === subjectId);
    if (!subjectToDelete) return;

    // Create backup before deleting subject
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'delete-subject',
        target: subjectToDelete.name,
        description: `Before deleting subject: ${subjectToDelete.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before deleting subject:', error);
    }

    setSubjects(subjects.filter(s => s.id !== subjectId));
    if (selectedSubject && selectedSubject.id === subjectId) {
      setCurrentView('subjects');
      setSelectedSubject(null);
    }
  };

  const addChapter = async () => {
    if (newChapterName.trim() && selectedSubject) {
      // Create backup before adding chapter
      try {
        const userData = { subjects, dismissedRevisions };
        await createBackup(userData, {
          type: 'change',
          action: 'add-chapter',
          target: newChapterName.trim(),
          subject: selectedSubject.name,
          description: `Before adding chapter: ${newChapterName.trim()} to ${selectedSubject.name}`
        });
      } catch (error) {
        console.error('Failed to create backup before adding chapter:', error);
      }

      const newChapter = {
        id: Date.now(),
        name: newChapterName.trim(),
        topicalsCompleted: false
      };

      setSubjects(subjects.map(subject =>
        subject.id === selectedSubject.id
          ? { ...subject, chapters: [...subject.chapters, newChapter] }
          : subject
      ));

      setSelectedSubject({
        ...selectedSubject,
        chapters: [...selectedSubject.chapters, newChapter]
      });

      setNewChapterName('');
      setShowAddChapter(false);
    }
  };

  const toggleChapterCompletion = async (chapterId) => {
    const chapterToToggle = selectedSubject.chapters.find(c => c.id === chapterId);
    if (!chapterToToggle) return;

    // Create backup before toggling completion
    try {
      const userData = { subjects, dismissedRevisions };
      const action = chapterToToggle.topicalsCompleted ? 'incomplete-chapter' : 'complete-chapter';
      await createBackup(userData, {
        type: 'change',
        action: action,
        target: chapterToToggle.name,
        subject: selectedSubject.name,
        description: `Before ${chapterToToggle.topicalsCompleted ? 'marking incomplete' : 'completing'}: ${chapterToToggle.name} in ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before toggling chapter completion:', error);
    }

    const updatedSubjects = subjects.map(subject =>
      subject.id === selectedSubject.id
        ? {
            ...subject,
            chapters: subject.chapters.map(chapter =>
              chapter.id === chapterId
                ? { ...chapter, topicalsCompleted: !chapter.topicalsCompleted }
                : chapter
            )
          }
        : subject
    );

    setSubjects(updatedSubjects);
    setSelectedSubject({
      ...selectedSubject,
      chapters: selectedSubject.chapters.map(chapter =>
        chapter.id === chapterId
          ? { ...chapter, topicalsCompleted: !chapter.topicalsCompleted }
          : chapter
      )
    });
  };

  const deleteChapter = async (chapterId) => {
    const chapterToDelete = selectedSubject.chapters.find(c => c.id === chapterId);
    if (!chapterToDelete) return;

    // Create backup before deleting chapter
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'delete-chapter',
        target: chapterToDelete.name,
        subject: selectedSubject.name,
        description: `Before deleting chapter: ${chapterToDelete.name} from ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before deleting chapter:', error);
    }

    setSubjects(subjects.map(subject =>
      subject.id === selectedSubject.id
        ? { ...subject, chapters: subject.chapters.filter(c => c.id !== chapterId) }
        : subject
    ));

    setSelectedSubject({
      ...selectedSubject,
      chapters: selectedSubject.chapters.filter(c => c.id !== chapterId)
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      // Create backup before reordering chapters
      try {
        const userData = { subjects, dismissedRevisions };
        await createBackup(userData, {
          type: 'change',
          action: 'reorder-chapters',
          subject: selectedSubject.name,
          description: `Before reordering chapters in ${selectedSubject.name}`
        });
      } catch (error) {
        console.error('Failed to create backup before reordering chapters:', error);
      }

      const oldIndex = selectedSubject.chapters.findIndex(chapter => chapter.id === active.id);
      const newIndex = selectedSubject.chapters.findIndex(chapter => chapter.id === over.id);

      const newChapters = arrayMove(selectedSubject.chapters, oldIndex, newIndex);

      const updatedSubjects = subjects.map(subject =>
        subject.id === selectedSubject.id
          ? { ...subject, chapters: newChapters }
          : subject
      );

      setSubjects(updatedSubjects);
      setSelectedSubject({
        ...selectedSubject,
        chapters: newChapters
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
   
  const addPastPaper = async () => {
    if (selectedSubject && newPaper.score !== '') {
      // Create backup before adding past paper
      try {
        const userData = { subjects, dismissedRevisions };
        await createBackup(userData, {
          type: 'change',
          action: 'add-paper',
          subject: selectedSubject.name,
          paperInfo: {
            session: newPaper.session,
            year: parseInt(newPaper.year),
            paperNumber: parseInt(newPaper.paperNumber)
          },
          description: `Before adding paper: ${newPaper.session} ${newPaper.year} Paper ${newPaper.paperNumber} for ${selectedSubject.name}`
        });
      } catch (error) {
        console.error('Failed to create backup before adding past paper:', error);
      }

      const paper = {
        id: Date.now(),
        session: newPaper.session,
        year: parseInt(newPaper.year),
        paperNumber: parseInt(newPaper.paperNumber),
        score: newPaper.score,
        hardChapters: newPaper.hardChapters
      };

      setSubjects(subjects.map(subject =>
        subject.id === selectedSubject.id
          ? { ...subject, pastPapers: [...subject.pastPapers, paper] }
          : subject
      ));

      setSelectedSubject({
        ...selectedSubject,
        pastPapers: [...selectedSubject.pastPapers, paper]
      });

      setNewPaper({
        session: 'MJ',
        year: new Date().getFullYear(),
        paperNumber: 1,
        score: '',
        hardChapters: ''
      });
      setShowAddPaper(false);
    }
  };

  const deletePastPaper = async (paperId) => {
    const paperToDelete = selectedSubject.pastPapers?.find(p => p.id === paperId);
    if (!paperToDelete) return;

    // Create backup before deleting past paper
    try {
      const userData = { subjects, dismissedRevisions };
      await createBackup(userData, {
        type: 'change',
        action: 'delete-paper',
        subject: selectedSubject.name,
        paperInfo: {
          session: paperToDelete.session,
          year: paperToDelete.year,
          paperNumber: paperToDelete.paperNumber
        },
        description: `Before deleting paper: ${paperToDelete.session} ${paperToDelete.year} Paper ${paperToDelete.paperNumber} for ${selectedSubject.name}`
      });
    } catch (error) {
      console.error('Failed to create backup before deleting past paper:', error);
    }

    setSubjects(subjects.map(subject =>
      subject.id === selectedSubject.id
        ? { ...subject, pastPapers: subject.pastPapers.filter(p => p.id !== paperId) }
        : subject
    ));

    setSelectedSubject({
      ...selectedSubject,
      pastPapers: selectedSubject.pastPapers.filter(p => p.id !== paperId)
    });
  };

  const getSubjectProgress = (subject) => {
    if (subject.chapters.length === 0) return 0;
    const completed = subject.chapters.filter(c => c.topicalsCompleted).length;
    return Math.round((completed / subject.chapters.length) * 100);
  };

  const getAverageScore = (subject) => {
    if (subject.pastPapers.length === 0) return 0;
    const total = subject.pastPapers.reduce((sum, paper) => sum + parseFloat(paper.score), 0);
    return Math.round(total / subject.pastPapers.length);
  };

  // Get revision status for a subject
  const getSubjectRevisionStatus = (subject) => {
    if (!subject.studySessions || subject.studySessions.length === 0) {
      return { hasDueRevisions: false, todayCount: 0 };
    }

    const today = new Date().toISOString().split('T')[0];
    let todayCount = 0;

    subject.studySessions.forEach(session => {
      session.revisions.forEach(revision => {
        if (!revision.completed && revision.date === today) {
          todayCount++;
        }
      });
    });

    return {
      hasDueRevisions: todayCount > 0,
      todayCount
    };
  };

  // Handle data restoration from backup
  const handleDataRestored = (restoredData) => {
    if (restoredData.subjects) {
      setSubjects(restoredData.subjects);
    }
    if (restoredData.dismissedRevisions) {
      setDismissedRevisions(new Set(restoredData.dismissedRevisions));
    }
    // If we're currently viewing a subject that might have changed, refresh the view
    if (selectedSubject) {
      const updatedSubject = restoredData.subjects?.find(s => s.id === selectedSubject.id);
      if (updatedSubject) {
        setSelectedSubject(updatedSubject);
      } else {
        // Subject was deleted in the restored data
        setCurrentView('subjects');
        setSelectedSubject(null);
      }
    }
  };

  if (currentView === 'subjects') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">Study Tracker</h1>
            <p className="text-gray-600">Track your progress across all subjects</p>
            <div className="mt-4">
              <button
                onClick={() => setShowBackupRestore(true)}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 mx-auto"
              >
                <Database size={16} />
                Backup & Restore
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {subjects.map(subject => {
              const revisionStatus = getSubjectRevisionStatus(subject);
              
              return (
                <div key={subject.id} className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border-l-4 ${
                  revisionStatus.todayCount > 0 ? 'border-yellow-500' : 'border-blue-500'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-800">{subject.name}</h3>
                      {revisionStatus.hasDueRevisions && (
                        <div className="flex items-center bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                          <Calendar size={12} className="mr-1" />
                          {revisionStatus.todayCount} due today
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteSubject(subject.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <BookOpen size={16} className="mr-2" />
                    <span>{subject.chapters.length} chapters</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText size={16} className="mr-2" />
                    <span>{subject.pastPapers.length} past papers</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Award size={16} className="mr-2" />
                    <span>Avg: {getAverageScore(subject)}%</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-blue-600 font-semibold">{getSubjectProgress(subject)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getSubjectProgress(subject)}%` }}
                    ></div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedSubject(subject);
                    setCurrentView('subject-detail');
                  }}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium"
                >
                  View Details
                </button>
              </div>
              );
            })}

            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border-2 border-dashed border-blue-300 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus size={24} className="text-blue-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Add New Subject</h3>
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="text-blue-500 hover:text-blue-700 font-medium"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>

          {showAddSubject && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                <h3 className="text-xl font-semibold mb-4">Add New Subject</h3>
                <input
                  type="text"
                  placeholder="Subject name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addSubject()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={addSubject}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Add Subject
                  </button>
                  <button
                    onClick={() => {
                      setShowAddSubject(false);
                      setNewSubjectName('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Backup & Restore Modal */}
          {showBackupRestore && (
            <BackupRestore
              userData={{ subjects, dismissedRevisions }}
              onDataRestored={handleDataRestored}
              onClose={() => setShowBackupRestore(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => setCurrentView('subjects')}
                className="text-blue-500 hover:text-blue-700 mb-2 flex items-center"
              >
                ← Back to Subjects
              </button>
              <h1 className="text-3xl font-bold text-blue-600">{selectedSubject.name}</h1>
            </div>
            <button
              onClick={() => setShowBackupRestore(true)}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Database size={16} />
              Backup & Restore
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setCalendarView('chapters')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              calendarView === 'chapters' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Chapters & Papers
          </button>
          <button
            onClick={() => setCalendarView('calendar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              calendarView === 'calendar' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Revision Calendar
          </button>
        </div>

        {calendarView === 'chapters' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chapters Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Chapters</h2>
                <button
                  onClick={() => setShowAddChapter(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Chapter
                </button>
              </div>

              {selectedSubject.chapters.length > 0 ? (
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={selectedSubject.chapters.map(chapter => chapter.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {selectedSubject.chapters.map(chapter => (
                        <SortableChapter key={chapter.id} chapter={chapter} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No chapters added yet</p>
                </div>
              )}
            </div>

            {/* Past Papers Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Past Papers</h2>
                <button
                  onClick={() => setShowAddPaper(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Paper
                </button>
              </div>

              <div className="space-y-3">
                {selectedSubject.pastPapers.map(paper => (
                  <div key={paper.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-800">
                          {paper.session} {paper.year} Paper {paper.paperNumber}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">Score: {paper.score}%</p>
                      </div>
                      <button
                        onClick={() => deletePastPaper(paper.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {paper.hardChapters && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Hard chapters:</span> {paper.hardChapters}
                      </div>
                    )}
                  </div>
                ))}
                
                {selectedSubject.pastPapers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No past papers added yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Today's Revisions */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Today's Revisions</h2>
                
                {shouldShowOverdueWarning() && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-red-700">
                        <AlertCircle size={20} className="mr-2" />
                        <span className="font-medium">Overdue Revisions</span>
                      </div>
                      <button
                        onClick={dismissOverdueWarning}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {getNonDismissedOverdueRevisions().map(revision => (
                      <div key={`${revision.sessionId}-${revision.revisionIndex}`} className="text-sm text-red-600 mb-1">
                        {revision.chapterName} - {revision.cycle} (Due: {new Date(revision.dueDate).toLocaleDateString()})
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {getRevisionsForToday().map(revision => (
                    <div key={`${revision.sessionId}-${revision.revisionIndex}`} 
                         className={`p-3 rounded-lg border ${
                           revision.completed 
                             ? 'bg-green-50 border-green-200' 
                             : 'bg-gray-50 border-gray-300'
                         }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-800">{revision.chapterName}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Original study date: {new Date(revision.studyDate).toLocaleDateString()}
                          </p>
                          <p className={`text-sm font-medium mt-1 ${
                            revision.completed ? 'text-green-700' : 'text-gray-700'
                          }`}>
                            {revision.cycle} revision
                          </p>
                        </div>
                        <button
                          onClick={() => toggleRevisionComplete(revision.sessionId, revision.revisionIndex)}
                          className={`transition-colors p-1 rounded ${
                            revision.completed 
                              ? 'text-green-600 hover:text-green-700' 
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {revision.completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {getRevisionsForToday().length === 0 && !shouldShowOverdueWarning() && (
                    <div className="text-center py-4 text-gray-500">
                      <CheckCircle size={48} className="mx-auto mb-2 opacity-50 text-green-500" />
                      <p>No revisions due today!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Add Study Session */}
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Study Session</h3>
                <select
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a chapter</option>
                  {selectedSubject.chapters.map(chapter => (
                    <option key={chapter.id} value={chapter.name}>{chapter.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (newChapterName) {
                      addStudySession(newChapterName, selectedDate.toISOString().split('T')[0]);
                      setNewChapterName('');
                    }
                  }}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add Study Session
                </button>
              </div>

              {/* Study Sessions List */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Study Sessions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedSubject.studySessions && selectedSubject.studySessions.length > 0 ? (
                    selectedSubject.studySessions
                      .sort((a, b) => {
                        // Get the earliest upcoming revision for each session
                        const getEarliestUpcomingRevision = (session) => {
                          const today = new Date().toISOString().split('T')[0];
                          const upcomingRevisions = session.revisions.filter(rev => !rev.completed && rev.date >= today);
                          if (upcomingRevisions.length === 0) {
                            // If no upcoming revisions, get the earliest overdue revision
                            const overdueRevisions = session.revisions.filter(rev => !rev.completed && rev.date < today);
                            return overdueRevisions.length > 0 ? overdueRevisions[0].date : '9999-12-31';
                          }
                          return upcomingRevisions[0].date;
                        };
                        
                        const aEarliestDate = getEarliestUpcomingRevision(a);
                        const bEarliestDate = getEarliestUpcomingRevision(b);
                        
                        return aEarliestDate.localeCompare(bEarliestDate);
                      })
                      .map(session => (
                      <div key={session.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{session.chapterName}</p>
                          <p className="text-xs text-gray-600">
                            Studied: {new Date(session.studyDate).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteStudySession(session.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center">No study sessions yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Calendar View */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentMonth(new Date())}
                      className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Study Session</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Upcoming Revision</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Overdue</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-medium text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {getCalendarDays().map((day, index) => {
                    const events = day ? getEventsForDate(day) : { studies: [], revisions: [] };
                    const isToday = day === new Date().getDate() && 
                                   currentMonth.getMonth() === new Date().getMonth() &&
                                   currentMonth.getFullYear() === new Date().getFullYear();
                    
                    // Create date string for this calendar day
                    const dateStr = day ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const todayStr = new Date().toISOString().split('T')[0];
                    
                    return (
                      <div
                        key={index}
                        onClick={() => handleDayClick(day)}
                        className={`min-h-[80px] p-2 border rounded-lg ${
                          day ? 'hover:bg-gray-50 cursor-pointer' : ''
                        } ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
                      >
                        {day && (
                          <>
                            <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                              {day}
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {/* Study sessions - always green */}
                              {events.studies.map(study => (
                                <div key={study.id} className="w-2 h-2 bg-green-500 rounded-full" title={`Studied: ${study.chapterName}`}></div>
                              ))}
                              
                              {/* Revisions */}
                              {events.revisions.map(revision => {
                                const isOverdue = dateStr < todayStr && !revision.completed;
                                const isCompleted = revision.completed;
                                
                                return (
                                  <div
                                    key={`${revision.sessionId}-${revision.revisionIndex}`}
                                    className={`w-2 h-2 rounded-full ${
                                      isCompleted 
                                        ? 'bg-green-500 ring-1 ring-green-600' 
                                        : isOverdue 
                                          ? 'bg-red-500'
                                          : 'bg-yellow-500'
                                    }`}
                                    title={`${revision.chapterName} - ${revision.cycle}${isCompleted ? ' (Completed)' : isOverdue ? ' (Overdue)' : ' (Upcoming)'}`}
                                  ></div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Chapter Modal */}
        {showAddChapter && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4">Add New Chapter</h3>
              <input
                type="text"
                placeholder="Chapter name"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addChapter()}
              />
              <div className="flex gap-3">
                <button
                  onClick={addChapter}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add Chapter
                </button>
                <button
                  onClick={() => {
                    setShowAddChapter(false);
                    setNewChapterName('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Past Paper Modal */}
        {showAddPaper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4">Add Past Paper</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
                  <select
                    value={newPaper.session}
                    onChange={(e) => setNewPaper({...newPaper, session: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MJ">MJ (May/June)</option>
                    <option value="ON">ON (Oct/Nov)</option>
                    <option value="JN">JN (January)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="number"
                    value={newPaper.year}
                    onChange={(e) => setNewPaper({...newPaper, year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="2000"
                    max="2030"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paper Number</label>
                  <input
                    type="text"
                    value={newPaper.paperNumber}
                    onChange={(e) => setNewPaper({...newPaper, paperNumber: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1, 2, 12, 42"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Score (%)</label>
                  <input
                    type="number"
                    value={newPaper.score}
                    onChange={(e) => setNewPaper({...newPaper, score: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    placeholder="Enter score"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hard Chapters (optional)</label>
                  <input
                    type="text"
                    value={newPaper.hardChapters}
                    onChange={(e) => setNewPaper({...newPaper, hardChapters: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Chapter 1, Chapter 3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={addPastPaper}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add Paper
                </button>
                <button
                  onClick={() => {
                    setShowAddPaper(false);
                    setNewPaper({
                      session: 'MJ',
                      year: new Date().getFullYear(),
                      paperNumber: 1,
                      score: '',
                      hardChapters: ''
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day Edit Modal */}
        {showDayEditModal && selectedDayData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  Edit Day - {new Date(selectedDayData.date).toLocaleDateString()}
                </h3>
                <button
                  onClick={() => setShowDayEditModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Study Sessions */}
              {selectedDayData.studies.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-800 mb-3">Study Sessions</h4>
                  <div className="space-y-2">
                    {selectedDayData.studies.map(study => (
                      <div key={study.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-green-800">{study.chapterName}</span>
                          <span className="text-sm text-green-600">Study Session</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revisions */}
              {selectedDayData.revisions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-800 mb-3">Revisions</h4>
                  <div className="space-y-3">
                    {selectedDayData.revisions.map(revision => {
                      const dateStr = selectedDayData.date;
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOverdue = dateStr < todayStr && !revision.completed;
                      
                      return (
                        <div 
                          key={`${revision.sessionId}-${revision.revisionIndex}`}
                          className={`p-3 border rounded-lg ${
                            revision.completed 
                              ? 'bg-green-50 border-green-200' 
                              : isOverdue 
                                ? 'bg-red-50 border-red-200'
                                : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-800">{revision.chapterName}</h5>
                              <p className="text-sm text-gray-600 mt-1">{revision.cycle}</p>
                              {isOverdue && !revision.completed && (
                                <p className="text-sm text-red-600 font-medium mt-1">Overdue</p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                toggleRevisionComplete(revision.sessionId, revision.revisionIndex);
                                // Update the modal data to reflect the change
                                const updatedRevisions = selectedDayData.revisions.map(rev => 
                                  rev.sessionId === revision.sessionId && rev.revisionIndex === revision.revisionIndex
                                    ? { ...rev, completed: !rev.completed }
                                    : rev
                                );
                                setSelectedDayData({
                                  ...selectedDayData,
                                  revisions: updatedRevisions
                                });
                              }}
                              className={`transition-colors p-1 rounded ${
                                revision.completed 
                                  ? 'text-green-600 hover:text-green-700' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              {revision.completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No events message */}
              {selectedDayData.studies.length === 0 && selectedDayData.revisions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No study sessions or revisions for this day</p>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDayEditModal(false)}
                  className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Restore Modal */}
        {showBackupRestore && (
          <BackupRestore
            userData={{ subjects, dismissedRevisions }}
            onDataRestored={handleDataRestored}
            onClose={() => setShowBackupRestore(false)}
          />
        )}
      </div>
    </div>
  );
};

export default StudyTracker;
