import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, CheckCircle, Circle, Edit2, Trash2, Award, Calendar, FileText } from 'lucide-react';

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

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedSubjects = localStorage.getItem('studyTrackerSubjects');
    if (savedSubjects) {
      setSubjects(JSON.parse(savedSubjects));
    }
  }, []);

  // Save data to localStorage whenever subjects change
  useEffect(() => {
    localStorage.setItem('studyTrackerSubjects', JSON.stringify(subjects));
  }, [subjects]);

  const addSubject = () => {
    if (newSubjectName.trim()) {
      const newSubject = {
        id: Date.now(),
        name: newSubjectName.trim(),
        chapters: [],
        pastPapers: []
      };
      setSubjects([...subjects, newSubject]);
      setNewSubjectName('');
      setShowAddSubject(false);
    }
  };

  const deleteSubject = (subjectId) => {
    setSubjects(subjects.filter(s => s.id !== subjectId));
    if (selectedSubject && selectedSubject.id === subjectId) {
      setCurrentView('subjects');
      setSelectedSubject(null);
    }
  };

  const addChapter = () => {
    if (newChapterName.trim() && selectedSubject) {
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

  const toggleChapterCompletion = (chapterId) => {
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

  const deleteChapter = (chapterId) => {
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
   
  const addPastPaper = () => {
    if (selectedSubject && newPaper.score !== '') {
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

  const deletePastPaper = (paperId) => {
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

  if (currentView === 'subjects') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">Study Tracker</h1>
            <p className="text-gray-600">Track your progress across all subjects</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {subjects.map(subject => (
              <div key={subject.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">{subject.name}</h3>
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
            ))}

            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border-2 border-dashed border-blue-300">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => setCurrentView('subjects')}
            className="text-blue-500 hover:text-blue-700 mb-2 flex items-center"
          >
            ← Back to Subjects
          </button>
          <h1 className="text-3xl font-bold text-blue-600">{selectedSubject.name}</h1>
        </div>

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

            <div className="space-y-3">
              {selectedSubject.chapters.map(chapter => (
                <div key={chapter.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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
                  <span className="text-sm text-gray-500">
                    {chapter.topicalsCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>
              ))}
              
              {selectedSubject.chapters.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No chapters added yet</p>
                </div>
              )}
            </div>
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
                    type="number"
                    value={newPaper.paperNumber}
                    onChange={(e) => setNewPaper({...newPaper, paperNumber: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="10"
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
      </div>
    </div>
  );
};

export default StudyTracker;
