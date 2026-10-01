"use client";

import * as React from "react";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import {
  QUESTION_TYPE_OPTIONS,
  QUESTION_DIFFICULTY_OPTIONS,
  type QuestionFormValue,
  type SubjectOption,
} from "./question-bank-ui";

/**
 * Bagian formulir isi soal yang dipakai halaman tambah (dialog) dan halaman
 * detail (mode ubah). Label selalu di atas input (DESIGN.md §11), target
 * sentuh minimal 44px, dan seluruh input ber-label HTML.
 */

export interface QuestionFormFieldsProps {
  value: QuestionFormValue;
  onChange: (next: QuestionFormValue) => void;
  subjects: SubjectOption[];
  idPrefix: string;
  disabled?: boolean;
}

const TEXTAREA_CLASS =
  "min-h-[96px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus-visible:outline-hidden focus-visible:border-teal-700 focus-visible:ring-1 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";

const OPTION_INPUT_CLASS =
  "min-h-[44px] min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus-visible:outline-hidden focus-visible:border-teal-700 focus-visible:ring-1 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:bg-stone-50";

export function QuestionFormFields({
  value,
  onChange,
  subjects,
  idPrefix,
  disabled = false,
}: QuestionFormFieldsProps) {
  const patch = (partial: Partial<QuestionFormValue>) =>
    onChange({ ...value, ...partial });

  const setOptionContent = (label: string, content: string) =>
    patch({
      options: value.options.map((opt) =>
        opt.label === label ? { ...opt, content } : opt
      ),
    });

  const setCorrectOption = (label: string) =>
    patch({
      options: value.options.map((opt) => ({
        ...opt,
        isCorrect: opt.label === label,
      })),
    });

  const isMultipleChoice = value.type === "MULTIPLE_CHOICE";
  const isShortAnswer = value.type === "SHORT_ANSWER";
  const isEssay = value.type === "ESSAY";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id={`${idPrefix}-subject`}
          label="Mata Pelajaran *"
          value={value.subjectId}
          onChange={(e) => patch({ subjectId: e.target.value })}
          disabled={disabled}
          helperText={
            subjects.length === 0
              ? "Belum ada mata pelajaran pada lembaga ini. Tambahkan lewat menu Mata Pelajaran."
              : undefined
          }
        >
          <option value="">Pilih mata pelajaran</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code ? `${subject.name} (${subject.code})` : subject.name}
            </option>
          ))}
        </Select>

        <Select
          id={`${idPrefix}-type`}
          label="Tipe Soal *"
          value={value.type}
          onChange={(e) => patch({ type: e.target.value })}
          disabled={disabled}
        >
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          id={`${idPrefix}-difficulty`}
          label="Tingkat Kesulitan"
          value={value.difficulty}
          onChange={(e) => patch({ difficulty: e.target.value })}
          disabled={disabled}
        >
          {QUESTION_DIFFICULTY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Input
          id={`${idPrefix}-topic`}
          label="Topik / Bab"
          type="text"
          value={value.topic}
          onChange={(e) => patch({ topic: e.target.value })}
          placeholder="Contoh: Bab 3, Surah Al-Baqarah"
          disabled={disabled}
          maxLength={150}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-stem`}
          className="block text-xs font-semibold text-stone-700"
        >
          Naskah Soal *
        </label>
        <textarea
          id={`${idPrefix}-stem`}
          rows={4}
          value={value.stem}
          onChange={(e) => patch({ stem: e.target.value })}
          placeholder="Tulis naskah soal lengkap di sini"
          disabled={disabled}
          maxLength={5000}
          className={TEXTAREA_CLASS}
        />
        <p className="text-xs text-stone-500">
          Minimal 5 karakter, maksimal 5000 karakter.
        </p>
      </div>

      {isMultipleChoice && (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="block text-xs font-semibold text-stone-700 mb-1.5">
            Opsi Jawaban (isi A sampai D, pilih satu kunci)
          </legend>
          {value.options.map((opt) => (
            <div
              key={opt.label}
              className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-2"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-xs font-bold text-stone-700"
              >
                {opt.label}
              </span>
              <input
                type="text"
                value={opt.content}
                onChange={(e) => setOptionContent(opt.label, e.target.value)}
                placeholder={`Teks opsi ${opt.label}`}
                aria-label={`Teks opsi ${opt.label}`}
                maxLength={1000}
                className={OPTION_INPUT_CLASS}
              />
              <label className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700">
                <input
                  type="radio"
                  name={`${idPrefix}-correct-option`}
                  checked={opt.isCorrect}
                  onChange={() => setCorrectOption(opt.label)}
                  className="h-4 w-4 border-stone-300 text-teal-700 focus:ring-teal-700"
                />
                Kunci
              </label>
            </div>
          ))}
        </fieldset>
      )}

      {isShortAnswer && (
        <Input
          id={`${idPrefix}-short-answer-key`}
          label="Kunci Jawaban *"
          type="text"
          value={value.shortAnswerKey}
          onChange={(e) => patch({ shortAnswerKey: e.target.value })}
          placeholder="Tulis jawaban baku untuk soal ini"
          disabled={disabled}
          maxLength={500}
        />
      )}

      {isEssay && (
        <p className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
          Soal esai tidak memiliki opsi maupun kunci jawaban teks. Tulis pedoman
          penskoran pada kolom Pembahasan.
        </p>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-explanation`}
          className="block text-xs font-semibold text-stone-700"
        >
          {isEssay ? "Pembahasan & Pedoman Penskoran" : "Pembahasan"}
        </label>
        <textarea
          id={`${idPrefix}-explanation`}
          rows={3}
          value={value.explanation}
          onChange={(e) => patch({ explanation: e.target.value })}
          placeholder={
            isEssay
              ? "Tulis pedoman penskoran atau rubrik penilaian"
              : "Tulis pembahasan atau kunci penjelasan (opsional)"
          }
          disabled={disabled}
          maxLength={5000}
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
}
