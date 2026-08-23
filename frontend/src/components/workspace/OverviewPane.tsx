import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  ChevronRight, 
  ChevronDown, 
  Edit3, 
  Layers, 
  Search, 
  X,
  Target,
  Users,
  Compass,
  GitPullRequest,
  Palette,
  HardDrive,
  Code,
  Milestone,
  AlertCircle
} from 'lucide-react';
import type { OverviewSection, ItemStatus } from '../../types/project';
import { StatusBadge, MaturityPill } from '../common/StatusBadge';
import { Modal } from '../common/Modal';

interface OverviewPaneProps {
  sections: OverviewSection[];
  onToggleLockItem?: (sectionId: string, itemId: string) => void;
  onUpdateItemContent?: (sectionId: string, itemId: string, newTitle: string, newContent: string, newStatus: ItemStatus) => void;
  onCloseSidebar?: () => void;
}

export const OverviewPane: React.FC<OverviewPaneProps> = ({
  sections,
  onToggleLockItem,
  onUpdateItemContent,
  onCloseSidebar,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | ItemStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'outline'>('cards');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'vision-scope': true,
    'user-personas': true,
    'core-flows': true,
    'tech-stack': true,
  });

  // Edit item state
  const [editingItem, setEditingItem] = useState<{
    sectionId: string;
    itemId: string;
    title: string;
    content: string;
    status: ItemStatus;
  } | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSectionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Target':
        return <Target className="w-4 h-4 text-orange-500" />;
      case 'Users':
        return <Users className="w-4 h-4 text-sky-500" />;
      case 'Compass':
        return <Compass className="w-4 h-4 text-emerald-500" />;
      case 'GitPullRequest':
        return <GitPullRequest className="w-4 h-4 text-purple-500" />;
      case 'Palette':
        return <Palette className="w-4 h-4 text-pink-500" />;
      case 'HardDrive':
        return <HardDrive className="w-4 h-4 text-amber-500" />;
      case 'Code':
        return <Code className="w-4 h-4 text-cyan-500" />;
      case 'Milestone':
        return <Milestone className="w-4 h-4 text-indigo-500" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-500" />;
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem || !onUpdateItemContent) return;
    onUpdateItemContent(
      editingItem.sectionId,
      editingItem.itemId,
      editingItem.title,
      editingItem.content,
      editingItem.status
    );
    setEditingItem(null);
  };

  // Filter sections and items
  const filteredSections = sections.map((sec) => {
    const matchedItems = sec.items.filter((item) => {
      const matchesFilter =
        activeFilter === 'all'
          ? true
          : activeFilter === 'locked'
          ? item.locked
          : item.status === activeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sec.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return {
      ...sec,
      items: matchedItems,
    };
  }).filter((sec) => sec.items.length > 0 || !searchQuery.trim());

  const totalConfirmed = sections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.status === 'confirmed').length,
    0
  );
  const totalCandidates = sections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.status === 'candidate').length,
    0
  );
  const totalUnresolved = sections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.status === 'unresolved').length,
    0
  );
  const totalLocked = sections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.locked).length,
    0
  );

  return (
    <div className="w-88 lg:w-[400px] border-l border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#0A0B0D] flex flex-col h-full shrink-0 select-none text-zinc-800 dark:text-zinc-200">
      {/* Pane Header */}
      <div className="p-3.5 border-b border-[#E5E2DA] dark:border-[#1E2026] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Project Overview
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Cards vs Outline Switcher */}
            <div className="flex rounded-lg bg-zinc-200/70 dark:bg-zinc-800 p-0.5 text-xs font-medium">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-[#15161A] text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                卡片
              </button>
              <button
                onClick={() => setViewMode('outline')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'outline'
                    ? 'bg-white dark:bg-[#15161A] text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                大纲树
              </button>
            </div>

            {onCloseSidebar && (
              <button
                onClick={onCloseSidebar}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                title="折叠全景面板"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Status Indicator Row */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#121316] border border-[#E5E2DA]/80 dark:border-[#1E2026]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{totalConfirmed} 确认</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>{totalCandidates} 候选</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{totalUnresolved} 待决</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-zinc-500" />
            <span>{totalLocked} 锁定</span>
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="快速过滤决策或范围..."
            className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          {(['all', 'confirmed', 'candidate', 'unresolved', 'locked'] as const).map((filter) => {
            const labels: Record<string, string> = {
              all: '全部',
              confirmed: '已确认',
              candidate: '候选',
              unresolved: '待决',
              locked: '已锁定',
            };
            const isSelected = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`text-[11px] px-2 py-1 rounded-md font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredSections.length > 0 ? (
          filteredSections.map((sec) => {
            const isExpanded = expandedSections[sec.id] ?? true;
            return (
              <div
                key={sec.id}
                className="rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#121316] overflow-hidden shadow-2xs transition-all"
              >
                {/* Section Header Accordion */}
                <div
                  onClick={() => toggleSection(sec.id)}
                  className="p-3 bg-[#F7F6F3]/60 dark:bg-[#15161A]/60 flex items-center justify-between cursor-pointer hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getSectionIcon(sec.iconName)}
                    <span className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {sec.title}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      ({sec.items.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <MaturityPill maturity={sec.maturity} />
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                </div>

                {/* Section Items */}
                {isExpanded && (
                  <div className="p-3 space-y-2.5 border-t border-[#E5E2DA]/80 dark:border-[#1E2026]">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {sec.summary}
                    </div>

                    {viewMode === 'cards' ? (
                      <div className="space-y-2">
                        {sec.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg border border-[#E5E2DA]/80 dark:border-[#1E2026] bg-[#F7F6F3]/50 dark:bg-[#16171B]/50 hover:bg-[#F7F6F3] dark:hover:bg-[#18191E] transition-all space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                                  {item.title}
                                </h4>
                                {item.locked && (
                                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5 text-zinc-500" />
                                    <span>Locked</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {onToggleLockItem && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLockItem(sec.id, item.id);
                                    }}
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                    title={item.locked ? '解锁条目' : '锁定此条决策'}
                                  >
                                    {item.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3" />}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingItem({
                                      sectionId: sec.id,
                                      itemId: item.id,
                                      title: item.title,
                                      content: item.content,
                                      status: item.status,
                                    });
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                  title="修改此条目"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                              {item.content}
                            </p>

                            {/* Note / Impact Callout */}
                            {item.note && (
                              <div className="p-2 rounded bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                <span className="font-semibold text-amber-800 dark:text-amber-300">📝 决策备注：</span>
                                {item.note}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/50 dark:border-[#1E2026]">
                              <StatusBadge status={item.status} size="sm" />
                              <span className="text-[11px] font-mono text-zinc-400">
                                {item.id}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Outline tree view */
                      <div className="space-y-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
                        {sec.items.map((item) => (
                          <div key={item.id} className="text-xs space-y-0.5 py-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                                {item.locked && <Lock className="w-2.5 h-2.5 text-zinc-400" />}
                                <span>{item.title}</span>
                              </span>
                              <StatusBadge status={item.status} size="sm" />
                            </div>
                            <p className="text-zinc-600 dark:text-zinc-400 line-clamp-1">
                              {item.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 space-y-2">
            <AlertCircle className="w-6 h-6 text-zinc-400 mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              没有找到匹配 &quot;{searchQuery}&quot; 的决策项
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="text-xs text-orange-600 hover:underline cursor-pointer"
            >
              清除搜索条件
            </button>
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title="修改 Overview 决策条目"
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300">条目标题</label>
              <input
                type="text"
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#111215] border border-[#E3E0D8] dark:border-[#23252B] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300">条目内容 / 规范描述</label>
              <textarea
                value={editingItem.content}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                rows={3}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#111215] border border-[#E3E0D8] dark:border-[#23252B] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-700 dark:text-zinc-300">状态标记</label>
              <select
                value={editingItem.status}
                onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as ItemStatus })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#111215] border border-[#E3E0D8] dark:border-[#23252B] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="confirmed">Confirmed 已确认</option>
                <option value="candidate">Candidate 候选</option>
                <option value="assumption">Assumption 假设</option>
                <option value="unresolved">Unresolved 待决</option>
                <option value="warning">Warning 风险</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3E0D8] dark:border-[#23252B]">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 rounded-lg border border-[#E3E0D8] dark:border-[#23252B] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium shadow-2xs"
              >
                保存变更
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
