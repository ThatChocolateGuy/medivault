import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Upload, FileText, Archive, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  autoImport,
  type ImportProgress,
  type ExtendedImportResult,
  type ImportPhase,
} from '../../lib/utils/import';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ImportStep = 'select' | 'options' | 'importing' | 'results';

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'zip' | null>(null);

  // Import options
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite' | 'rename'>(
    'skip'
  );
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [createMissingLocations, setCreateMissingLocations] = useState(true);
  const [preserveIds, setPreserveIds] = useState(false);

  // Progress tracking
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Results
  const [result, setResult] = useState<ExtendedImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Success message timeout
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset after animation completes
      setTimeout(() => {
        setStep('select');
        setSelectedFile(null);
        setFileType(null);
        setProgress(null);
        setResult(null);
        setError(null);
        setIsImporting(false);
      }, 300);
    }
  }, [isOpen]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
      setFileType('csv');
      setSelectedFile(file);
      setError(null);
    } else if (fileName.endsWith('.zip')) {
      setFileType('zip');
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Invalid file type. Please select a CSV or ZIP file.');
      setSelectedFile(null);
      setFileType(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileType(null);
    setError(null);
  };

  const handleNext = () => {
    if (step === 'select' && selectedFile) {
      setStep('options');
    }
  };

  const handleBack = () => {
    if (step === 'options') {
      setStep('select');
    } else if (step === 'results') {
      setStep('select');
      setResult(null);
      setProgress(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setStep('importing');
    setError(null);
    setProgress({
      phase: 'parsing',
      itemsProcessed: 0,
      itemsTotal: 0,
      percentComplete: 0,
      message: 'Starting import...',
    });

    try {
      const importResult = await autoImport(selectedFile, {
        duplicateStrategy,
        createMissingCategories,
        createMissingLocations,
        preserveIds,
        onProgress: (prog) => {
          setProgress(prog);
        },
      });

      setResult(importResult);
      setIsImporting(false);

      if (importResult.success) {
        setStep('results');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setStep('results');
        setError(importResult.errors.join('\n'));
      }
    } catch (err) {
      setIsImporting(false);
      setStep('results');
      setError(err instanceof Error ? err.message : 'Import failed');
      setResult({
        success: false,
        itemsImported: 0,
        itemsSkipped: 0,
        itemsOverwritten: 0,
        itemsRenamed: 0,
        categoriesCreated: 0,
        locationsCreated: 0,
        photosRestored: 0,
        errors: [err instanceof Error ? err.message : 'Import failed'],
        warnings: [],
        duration: 0,
      });
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onClose();
    }
  };

  const renderFileSelect = () => (
    <div className="space-y-4">
      {/* File input area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          selectedFile
            ? 'border-green-300 bg-green-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.zip"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Select CSV or ZIP file to import"
        />

        {!selectedFile ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select File to Import</h3>
              <p className="text-sm text-gray-500 mb-4">
                Choose a CSV file (data only) or ZIP file (data with photos)
              </p>

              <div className="flex justify-center">
                <Button onClick={() => fileInputRef.current?.click()} variant="primary">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>CSV</span>
              </div>
              <div className="flex items-center gap-1">
                <Archive className="w-4 h-4" />
                <span>ZIP</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                {fileType === 'csv' ? (
                  <FileText className="w-8 h-8 text-green-600" />
                ) : (
                  <Archive className="w-8 h-8 text-green-600" />
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">{selectedFile.name}</h3>
              <p className="text-sm text-gray-500 mb-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {fileType === 'csv'
                  ? 'CSV file (data only)'
                  : 'ZIP file (data with photos)'}
              </p>

              <div className="flex gap-2 justify-center">
                <Button onClick={handleRemoveFile} variant="secondary">
                  Remove
                </Button>
                <Button onClick={handleNext} variant="primary">
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );

  const renderOptions = () => (
    <div className="space-y-6">
      {/* Duplicate handling */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Duplicate Handling
        </label>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="duplicate"
              value="skip"
              checked={duplicateStrategy === 'skip'}
              onChange={(e) => setDuplicateStrategy(e.target.value as 'skip')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Skip Duplicates</div>
              <div className="text-sm text-gray-500">
                Don't import items that already exist
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="duplicate"
              value="overwrite"
              checked={duplicateStrategy === 'overwrite'}
              onChange={(e) => setDuplicateStrategy(e.target.value as 'overwrite')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Overwrite Existing</div>
              <div className="text-sm text-gray-500">
                Replace existing items with imported data
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="duplicate"
              value="rename"
              checked={duplicateStrategy === 'rename'}
              onChange={(e) => setDuplicateStrategy(e.target.value as 'rename')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Create as New (Rename)</div>
              <div className="text-sm text-gray-500">
                Import duplicates with unique names (e.g., "Aspirin (2)")
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Additional options */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={createMissingCategories}
            onChange={(e) => setCreateMissingCategories(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium text-gray-900">Create Missing Categories</div>
            <div className="text-sm text-gray-500">
              Automatically create new categories if they don't exist
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={createMissingLocations}
            onChange={(e) => setCreateMissingLocations(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium text-gray-900">Create Missing Locations</div>
            <div className="text-sm text-gray-500">
              Automatically create new locations if they don't exist
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={preserveIds}
            onChange={(e) => setPreserveIds(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium text-gray-900">Preserve Item IDs</div>
            <div className="text-sm text-gray-500">
              Try to keep original item IDs from export (may fail if IDs already exist)
            </div>
          </div>
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <Button onClick={handleBack} variant="secondary" className="flex-1">
          Back
        </Button>
        <Button onClick={handleImport} variant="primary" className="flex-1">
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      </div>
    </div>
  );

  const renderProgress = () => {
    const phaseLabels: Record<ImportPhase, string> = {
      parsing: 'Parsing File',
      validating: 'Validating Data',
      importing: 'Importing Items',
      photos: 'Restoring Photos',
      complete: 'Complete',
      error: 'Error',
    };

    return (
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          </div>

          <div>
            <h3
              className="text-lg font-medium text-gray-900 mb-2"
              aria-live="polite"
              aria-atomic="true"
            >
              {progress?.phase ? phaseLabels[progress.phase] : 'Processing...'}
            </h3>
            <p className="text-sm text-gray-600" aria-live="polite" aria-atomic="true">
              {progress?.message || 'Please wait...'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress?.percentComplete || 0}%` }}
              role="progressbar"
              aria-valuenow={progress?.percentComplete || 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Import progress"
            />
          </div>

          <p className="text-sm text-gray-500">
            {progress?.percentComplete?.toFixed(0) || 0}% complete
          </p>
        </div>

        {/* Progress details */}
        {progress && progress.itemsTotal > 0 && (
          <div className="text-sm text-gray-600 text-center">
            <p>
              Processed {progress.itemsProcessed} of {progress.itemsTotal} items
            </p>
            {progress.currentItem && (
              <p className="text-gray-500 mt-1">Current: {progress.currentItem}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const hasErrors = result && !result.success;
    const hasWarnings = result && result.warnings.length > 0;

    return (
      <div className="space-y-6">
        {/* Result icon and message */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                hasErrors ? 'bg-red-100' : 'bg-green-100'
              }`}
            >
              {hasErrors ? (
                <AlertCircle className="w-8 h-8 text-red-600" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              )}
            </div>
          </div>

          <h3
            className={`text-lg font-medium mb-2 ${
              hasErrors ? 'text-red-900' : 'text-green-900'
            }`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {hasErrors ? 'Import Failed' : 'Import Complete'}
          </h3>

          {result && result.success && (
            <p className="text-sm text-gray-600">
              Successfully imported {result.itemsImported} item(s) in {(result.duration / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        {/* Statistics */}
        {result && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">
                {result.itemsImported}
              </div>
              <div className="text-sm text-gray-600">Imported</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">{result.itemsSkipped}</div>
              <div className="text-sm text-gray-600">Skipped</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">
                {result.itemsOverwritten}
              </div>
              <div className="text-sm text-gray-600">Overwritten</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">{result.itemsRenamed}</div>
              <div className="text-sm text-gray-600">Renamed</div>
            </div>
          </div>
        )}

        {/* Additional info */}
        {result && (result.categoriesCreated > 0 || result.locationsCreated > 0 || result.photosRestored > 0) && (
          <div className="space-y-2 text-sm">
            {result.categoriesCreated > 0 && (
              <p className="text-gray-700">
                Created {result.categoriesCreated} new {result.categoriesCreated === 1 ? 'category' : 'categories'}
              </p>
            )}
            {result.locationsCreated > 0 && (
              <p className="text-gray-700">
                Created {result.locationsCreated} new {result.locationsCreated === 1 ? 'location' : 'locations'}
              </p>
            )}
            {result.photosRestored > 0 && (
              <p className="text-gray-700">
                Restored {result.photosRestored} {result.photosRestored === 1 ? 'photo' : 'photos'}
              </p>
            )}
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Warnings
            </h4>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Errors */}
        {hasErrors && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Errors
            </h4>
            <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
              {result.errors.map((err, index) => (
                <li key={index}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button onClick={handleBack} variant="secondary" className="flex-1">
            Import Another
          </Button>
          <Button onClick={handleClose} variant="primary" className="flex-1">
            Done
          </Button>
        </div>
      </div>
    );
  };

  const stepContent = {
    select: renderFileSelect(),
    options: renderOptions(),
    importing: renderProgress(),
    results: renderResults(),
  };

  const stepTitles = {
    select: 'Import Inventory Data',
    options: 'Import Options',
    importing: 'Importing...',
    results: result?.success ? 'Import Complete' : 'Import Results',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={stepTitles[step]}
      maxWidth="md"
      closeOnBackdrop={!isImporting}
    >
      <div aria-busy={isImporting} aria-live="polite">
        {stepContent[step]}
      </div>
    </Modal>
  );
}
