                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Module</span>
              </button>
            </div>

            <div className="space-y-4">
              {sections.map((section, secIdx) => (
                <div
                  key={section.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  {/* Module Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {secIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const updated = [...sections];
                          updated[secIdx].title = e.target.value;
                          setSections(updated);
                        }}
                        className="flex-1 font-extrabold text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
