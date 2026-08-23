import React, { useState, useEffect } from 'react';
import type { 
  ProjectState, 
  AttachedFile, 
  TimelineMessage, 
  ItemStatus 
} from './types/project';
import { HomePage } from './components/home/HomePage';
import { TopNav } from './components/layout/TopNav';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { Timeline } from './components/workspace/Timeline';
import { ChatInput } from './components/workspace/ChatInput';
import { OverviewPane } from './components/workspace/OverviewPane';
import { FilesView } from './components/workspace/FilesView';
import { ReadinessView } from './components/workspace/ReadinessView';
import { DocumentsView } from './components/workspace/DocumentsView';
import { SettingsView } from './components/workspace/SettingsView';
import { ToastProvider, useToast } from './components/common/Toast';

import { INITIAL_OVERVIEW_SECTIONS } from './data/mockOverview';
import { INITIAL_TIMELINE_MESSAGES } from './data/mockTimeline';
import { INITIAL_READINESS_DATA } from './data/mockReadiness';
import { MOCK_DOCUMENTS } from './data/mockDocuments';
import type { RecentProjectSummary } from './data/mockProjects';

function MainApp() {
  const { showToast } = useToast();

  // Theme mode: Default to saved preference or system preference
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('pa_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pa_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pa_theme', 'light');
    }
  }, [darkMode]);

  // Default initial screen is HOME as requested
  const [currentView, setCurrentView] = useState<'home' | 'workspace'>('home');

  // Workspace tab: 'chat' | 'files' | 'documents' | 'readiness' | 'settings'
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'documents' | 'readiness' | 'settings'>('chat');

  // Layout sidebar states
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(true);

  // Active Project State
  const [project, setProject] = useState<ProjectState>({
    id: 'proj-architect',
    name: 'Project Architect (项目构思工作台)',
    tagline: '在编码前把项目想清楚，把模糊想法转化为工程级规范与 Coding Agent 蓝图',
    stage: 'deep_dive',
    updatedAt: '刚刚',
    stateRevision: 'rev-20260822-04',
    tags: ['本地优先', 'AI 工作台', '开发者工具', 'Markdown 生成'],
    attachedFiles: [
      {
        id: 'file-1',
        name: 'rough_ideas_draft.md',
        size: '12 KB',
        type: 'markdown',
        status: 'parsed',
        summary: '初步罗列了单人开发场景痛点与三栏布局设想'
      },
      {
        id: 'file-2',
        name: 'linear_design_teardown.png',
        size: '1.2 MB',
        type: 'image',
        status: 'parsed',
        summary: 'Linear UI Refresh 暖灰中性色与安静工作台设计参考'
      }
    ],
    overviewSections: INITIAL_OVERVIEW_SECTIONS,
    timeline: INITIAL_TIMELINE_MESSAGES,
    readiness: INITIAL_READINESS_DATA,
    documents: MOCK_DOCUMENTS,
  });

  // Handle starting a project from home
  const handleStartProject = (ideaText: string, attachedFiles: AttachedFile[]) => {
    const newProject: ProjectState = {
      ...project,
      name: ideaText.slice(0, 24) + '...',
      tagline: ideaText,
      attachedFiles,
      timeline: [
        {
          id: 'msg-user-init',
          sender: 'user',
          type: 'idea_prompt',
          timestamp: '14:20',
          content: ideaText,
          attachedFiles,
        },
        INITIAL_TIMELINE_MESSAGES[1], // Initial analysis
        INITIAL_TIMELINE_MESSAGES[2], // Question card
      ],
    };

    setProject(newProject);
    setCurrentView('workspace');
    setActiveTab('chat');
    showToast('已进入项目工作台', '首次结构化理解分析已完成', 'success');
  };

  // Open recent project
  const handleOpenRecentProject = (rec: RecentProjectSummary) => {
    setProject((prev) => ({
      ...prev,
      name: rec.name,
      tagline: rec.tagline,
      stage: rec.stage,
    }));
    setCurrentView('workspace');
    setActiveTab('chat');
    showToast('已恢复项目工作台', rec.name, 'info');
  };

  // Answering Gap Question: Neutral mock simulation (records user intent without hardcoding technical decisions)
  const handleAnswerQuestion = (questionId: string, selectedOptionId?: string, customText?: string) => {
    // 1. Mark question as answered in timeline
    const updatedTimeline: TimelineMessage[] = project.timeline.map((msg) => {
      if (msg.type === 'question_card' && msg.question?.id === questionId) {
        return {
          ...msg,
          question: {
            ...msg.question,
            isAnswered: true,
            selectedOptionId,
            customAnswer: customText,
          },
        };
      }
      return msg;
    });

    // 2. Add user intent message to timeline
    const decisionMessage: TimelineMessage = {
      id: 'msg-decision-' + Date.now(),
      sender: 'user',
      type: 'user_decision',
      timestamp: '14:25',
      content: customText
        ? `用户补充输入：${customText}`
        : '已选择方案 A：纯本地 JSON 文件夹存储 + 单项目独立目录。',
    };

    // 3. Simulated neutral follow-up assistant card
    const readinessFollowUp: TimelineMessage = {
      id: 'msg-readiness-' + Date.now(),
      sender: 'assistant',
      type: 'readiness_card',
      timestamp: '14:26',
    };

    // 4. Update Overview sections to reflect user's input
    const updatedOverview = project.overviewSections.map((section) => {
      if (section.id === 'mvp_scope') {
        return {
          ...section,
          maturity: 'mostly_clear' as const,
          items: section.items.map((it) =>
            it.id === 'mvp-3'
              ? {
                  ...it,
                  title: '存储架构方向 (用户已选择方案 A)',
                  content: customText || '用户已确认倾向：纯本地 JSON 文件夹存储。',
                  status: 'confirmed' as const,
                  locked: false,
                  impact: undefined,
                  note: '根据用户在提问中的选择更新。',
                }
              : it
          ),
        };
      }
      return section;
    });

    // 5. Update Readiness state revision
    const updatedReadiness = {
      ...project.readiness,
      stateRevision: 'rev-20260822-05',
      buckets: {
        ...project.readiness.buckets,
        highIssues: [],
        ready: [
          ...project.readiness.buckets.ready,
          {
            id: 'r-storage-resolved',
            title: '存储架构方向已明确',
            desc: '已记录用户选择并同步至 Overview。',
          },
        ],
      },
    };

    setProject({
      ...project,
      timeline: [...updatedTimeline, decisionMessage, readinessFollowUp],
      overviewSections: updatedOverview,
      readiness: updatedReadiness,
      stateRevision: 'rev-20260822-05',
    });

    showToast('已提交回答意图并同步', 'Overview 与状态模型已完成单次更新', 'success');
  };

  // Toggle lock item in Overview
  const handleToggleLockItem = (sectionId: string, itemId: string) => {
    setProject((prev) => ({
      ...prev,
      overviewSections: prev.overviewSections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((it) => {
            if (it.id !== itemId) return it;
            return { ...it, locked: !it.locked };
          }),
        };
      }),
    }));
  };

  // Update item content in Overview
  const handleUpdateItemContent = (
    sectionId: string,
    itemId: string,
    newTitle: string,
    newContent: string,
    newStatus: ItemStatus
  ) => {
    setProject((prev) => ({
      ...prev,
      overviewSections: prev.overviewSections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((it) => {
            if (it.id !== itemId) return it;
            return {
              ...it,
              title: newTitle,
              content: newContent,
              status: newStatus,
            };
          }),
        };
      }),
    }));
  };

  // Add message from bottom ChatInput
  const handleSendMessage = (text: string) => {
    const userMsg: TimelineMessage = {
      id: 'msg-usr-' + Date.now(),
      sender: 'user',
      type: 'idea_prompt',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text,
    };

    // Simulated AI structured reply
    const aiReply: TimelineMessage = {
      id: 'msg-ai-' + Date.now(),
      sender: 'assistant',
      type: 'initial_analysis',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      analysis: {
        confirmed: [`已提取并合并最新约束: "${text.slice(0, 40)}..."`],
        candidates: ['建议在 Overview 对应的动态模块中补充此边界规范'],
        assumptions: ['保持原有单人自用与最小化上下文原则不变'],
        unresolvedGaps: [],
        warnings: [],
        recommendations: [
          {
            title: '已自动同步至 Project State',
            rationale: '当前已具备生成条件，可随时切换至【准备度审阅】或【规格蓝图】。',
          },
        ],
      },
    };

    setProject((prev) => ({
      ...prev,
      timeline: [...prev.timeline, userMsg, aiReply],
    }));

    showToast('已提交意图并完成单次分析', 'Project State 已更新', 'success');
  };

  // Reset Demo State
  const handleResetDemo = () => {
    setProject({
      id: 'proj-architect',
      name: 'Project Architect (项目构思工作台)',
      tagline: '在编码前把项目想清楚，把模糊想法转化为工程级规范与 Coding Agent 蓝图',
      stage: 'deep_dive',
      updatedAt: '刚刚',
      stateRevision: 'rev-20260822-04',
      tags: ['本地优先', 'AI 工作台', '开发者工具', 'Markdown 生成'],
      attachedFiles: [
        {
          id: 'file-1',
          name: 'rough_ideas_draft.md',
          size: '12 KB',
          type: 'markdown',
          status: 'parsed',
          summary: '初步罗列了单人开发场景痛点与三栏布局设想'
        },
        {
          id: 'file-2',
          name: 'linear_design_teardown.png',
          size: '1.2 MB',
          type: 'image',
          status: 'parsed',
          summary: 'Linear UI Refresh 暖灰中性色与安静工作台设计参考'
        }
      ],
      overviewSections: INITIAL_OVERVIEW_SECTIONS,
      timeline: INITIAL_TIMELINE_MESSAGES,
      readiness: INITIAL_READINESS_DATA,
      documents: MOCK_DOCUMENTS,
    });
    setActiveTab('chat');
  };

  if (currentView === 'home') {
    return (
      <HomePage
        onStartProject={handleStartProject}
        onOpenRecentProject={handleOpenRecentProject}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#FAF9F6] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 font-sans antialiased transition-colors">
      {/* 1. Predictable Top Bar */}
      <TopNav
        project={project}
        activeTab={activeTab}
        leftSidebarOpen={leftSidebarOpen}
        setLeftSidebarOpen={setLeftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        setRightSidebarOpen={setRightSidebarOpen}
        onNavigateHome={() => setCurrentView('home')}
        onOpenReadiness={() => setActiveTab('readiness')}
        onOpenDocuments={() => setActiveTab('documents')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* 2. Main 3-Column Workbench Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Navigation Sidebar */}
        <LeftSidebar
          project={project}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={leftSidebarOpen}
          onNewProject={() => setCurrentView('home')}
        />

        {/* Center Column: Active View / Timeline Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#16171B] relative">
          {activeTab === 'chat' && (
            <>
              <Timeline
                messages={project.timeline}
                onAnswerQuestion={handleAnswerQuestion}
                onOpenReadiness={() => setActiveTab('readiness')}
                onOpenDocuments={() => setActiveTab('documents')}
              />
              <ChatInput
                onSendMessage={handleSendMessage}
                onTriggerReadiness={() => setActiveTab('readiness')}
                onAddAttachment={() => {
                  showToast('已挂载模拟参考材料', '已添加 system_constraints.md', 'success');
                }}
              />
            </>
          )}

          {activeTab === 'files' && (
            <FilesView
              files={project.attachedFiles}
              onAddFile={(file) => {
                setProject((prev) => ({
                  ...prev,
                  attachedFiles: [...prev.attachedFiles, file],
                }));
              }}
              onRemoveFile={(id) => {
                setProject((prev) => ({
                  ...prev,
                  attachedFiles: prev.attachedFiles.filter((f) => f.id !== id),
                }));
              }}
            />
          )}

          {activeTab === 'readiness' && (
            <ReadinessView
              readiness={project.readiness}
              onApproveDocuments={() => {
                setActiveTab('documents');
              }}
              onReturnToDiscovery={() => setActiveTab('chat')}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              documents={project.documents}
              onToggleOverview={() => setRightSidebarOpen((prev) => !prev)}
              isOverviewOpen={rightSidebarOpen}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView onResetDemo={handleResetDemo} />
          )}
        </main>

        {/* Right Column: Project Overview Pane (Collapsible) */}
        {rightSidebarOpen && (
          <OverviewPane
            sections={project.overviewSections}
            onToggleLockItem={handleToggleLockItem}
            onUpdateItemContent={handleUpdateItemContent}
            onCloseSidebar={() => setRightSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
