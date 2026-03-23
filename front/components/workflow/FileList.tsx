type FileListProps = {
  files: File[];
  onRemove?: (index: number) => void;
};

export default function FileList({ files, onRemove }: FileListProps) {
  if (!files.length) return null;

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <ul className="space-y-2">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${index}`}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/50"
        >
          <span className="truncate text-slate-700 dark:text-slate-200">
            {file.name} ({formatSize(file.size)})
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-3 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
