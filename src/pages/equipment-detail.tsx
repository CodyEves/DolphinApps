import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "fill_blank"
  | "file_upload";

type ChoiceForm = {
  clientId: string;
  text: string;
  isCorrect: boolean;
};

type QuestionForm = {
  clientId: string;
  id?: Id<"questions">;
  type: QuestionType;
  prompt: string;
  choices: ChoiceForm[];
  correctAnswer: string;
  allowMultipleCorrect: boolean;
  points: string;
};

type EquipmentForm = {
  name: string;
  category: string;
  description: string;
  videoUrl: string;
  instructorApprovalRequired: boolean;
  isActive: boolean;
  passingScorePercent: string;
  questions: QuestionForm[];
};


function youtubeEmbedUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host.endsWith("youtube.com")) {
      if (parsedUrl.pathname.startsWith("/embed/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      } else if (parsedUrl.pathname.startsWith("/shorts/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      } else {
        videoId = parsedUrl.searchParams.get("v");
      }
    }

    if (!videoId) {
      return null;
    }

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("modestbranding", "1");

    if (typeof window !== "undefined") {
      embedUrl.searchParams.set("origin", window.location.origin);
    }

    return embedUrl.toString();
  } catch {
    return null;
  }
}

function externalVideoUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}
function createQuestion(type: QuestionType = "multiple_choice"): QuestionForm {
  return {
    clientId: crypto.randomUUID(),
    type,
    prompt: "",
    choices:
      type === "multiple_choice"
        ? [
            { clientId: crypto.randomUUID(), text: "Option A", isCorrect: true },
            { clientId: crypto.randomUUID(), text: "Option B", isCorrect: false },
          ]
        : [],
    correctAnswer: type === "true_false" ? "true" : "",
    allowMultipleCorrect: false,
    points: "1",
  };
}

function parseCorrectAnswers(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((answer): answer is string => typeof answer === "string");
    }
  } catch {
    return [value];
  }

  return [value];
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatFileSize(size: number | undefined) {
  if (size === undefined) {
    return "";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedSopFile(file: File) {
  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const allowedExtensions = [".pdf", ".doc", ".docx"];
  const fileName = file.name.toLowerCase();

  return (
    allowedTypes.has(file.type) ||
    allowedExtensions.some((extension) => fileName.endsWith(extension))
  );
}

export function EquipmentDetailPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const params = useParams();
  const equipmentId = params.equipmentId as Id<"equipment"> | undefined;
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const equipmentRecord = useQuery(
    api.equipment.getEquipment,
    isAuthenticated && equipmentId ? { equipmentId } : "skip",
  );
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const usersReadyForSignOff = useQuery(
    api.equipment.listUsersReadyForEquipmentSignOff,
    isAuthenticated && isAdmin && equipmentId ? { equipmentId } : "skip",
  );
  const saveEquipment = useMutation(api.equipment.saveEquipment);
  const setHandsOnDemonstration = useMutation(
    api.equipment.setHandsOnDemonstration,
  );
  const submitEquipmentSafetyTest = useMutation(
    api.equipment.submitEquipmentSafetyTest,
  );
  const markEquipmentVideoComplete = useMutation(
    api.equipment.markEquipmentVideoComplete,
  );
  const generateSopUploadUrl = useMutation(api.equipment.generateSopUploadUrl);
  const addSopDocument = useMutation(api.equipment.addSopDocument);
  const deleteSopDocument = useMutation(api.equipment.deleteSopDocument);
  const [forms, setForms] = useState<Record<string, EquipmentForm>>({});
  const [testAnswers, setTestAnswers] = useState<Record<string, string | string[]>>({});
  const [savingEquipmentId, setSavingEquipmentId] = useState<string | null>(null);
  const [savingSignOffKey, setSavingSignOffKey] = useState<string | null>(null);
  const [submittingTestId, setSubmittingTestId] = useState<string | null>(null);
  const [completingVideoId, setCompletingVideoId] = useState<string | null>(null);
  const [uploadingSopId, setUploadingSopId] = useState<string | null>(null);
  const [deletingSopId, setDeletingSopId] = useState<string | null>(null);
  const equipment = useMemo(
    () =>
      equipmentRecord && (isAdmin || equipmentRecord.isActive)
        ? [equipmentRecord]
        : equipmentRecord === undefined
          ? undefined
          : [],
    [equipmentRecord, isAdmin],
  );

  useEffect(() => {
    if (!equipment) {
      return;
    }

    // Hydrate editable form state after the equipment records load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForms((current) => {
      const next = { ...current };

      for (const item of equipment) {
        const hasLocalForm = next[item._id];

        if (hasLocalForm) {
          continue;
        }

        next[item._id] = {
          name: item.name,
          category: item.category,
          description: item.description,
          videoUrl: item.videoUrl ?? "",
          instructorApprovalRequired: item.instructorApprovalRequired,
          isActive: item.isActive,
          passingScorePercent: String(item.quiz?.passingScorePercent ?? 80),
          questions: item.questions.map((question) => {
            const correctAnswers = parseCorrectAnswers(question.correctAnswer);
            const choices =
              question.type === "multiple_choice"
                ? (question.choices ?? ["Option A", "Option B"]).map((choice) => ({
                    clientId: crypto.randomUUID(),
                    text: choice,
                    isCorrect: correctAnswers.includes(choice),
                  }))
                : [];

            return {
              clientId: question._id,
              id: question._id,
              type: question.type,
              prompt: question.prompt,
              choices,
              correctAnswer: question.correctAnswer ?? "",
              allowMultipleCorrect:
                question.allowMultipleCorrect === true ||
                correctAnswers.length > 1,
              points: String(question.points),
            };
          }),
        };
      }

      return next;
    });
  }, [equipment]);

  function patchForm(equipmentId: Id<"equipment">, patch: Partial<EquipmentForm>) {
    setForms((current) => ({
      ...current,
      [equipmentId]: {
        ...current[equipmentId],
        ...patch,
      },
    }));
  }

  function updateQuestion(
    equipmentId: Id<"equipment">,
    questionClientId: string,
    patch: Partial<QuestionForm>,
  ) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.map((question) =>
        question.clientId === questionClientId
          ? { ...question, ...patch }
          : question,
      ),
    });
  }

  function addQuestion(equipmentId: Id<"equipment">) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: [...form.questions, createQuestion()],
    });
  }

  function removeQuestion(equipmentId: Id<"equipment">, questionClientId: string) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.filter(
        (question) => question.clientId !== questionClientId,
      ),
    });
  }

  function addChoice(equipmentId: Id<"equipment">, questionClientId: string) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: [
                ...question.choices,
                {
                  clientId: crypto.randomUUID(),
                  text: `Option ${question.choices.length + 1}`,
                  isCorrect: false,
                },
              ],
            }
          : question,
      ),
    });
  }

  function updateChoice(
    equipmentId: Id<"equipment">,
    questionClientId: string,
    choiceClientId: string,
    text: string,
  ) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.clientId === choiceClientId ? { ...choice, text } : choice,
              ),
            }
          : question,
      ),
    });
  }

  function removeChoice(
    equipmentId: Id<"equipment">,
    questionClientId: string,
    choiceClientId: string,
  ) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.filter(
                (choice) => choice.clientId !== choiceClientId,
              ),
            }
          : question,
      ),
    });
  }

  function setChoiceCorrect(
    equipmentId: Id<"equipment">,
    questionClientId: string,
    choiceClientId: string,
    isCorrect: boolean,
  ) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    patchForm(equipmentId, {
      questions: form.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.map((choice) => {
                if (question.allowMultipleCorrect) {
                  return choice.clientId === choiceClientId
                    ? { ...choice, isCorrect }
                    : choice;
                }

                return {
                  ...choice,
                  isCorrect: choice.clientId === choiceClientId,
                };
              }),
            }
          : question,
      ),
    });
  }

  function setSingleTestAnswer(questionId: Id<"questions">, answer: string) {
    setTestAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  }

  function toggleMultiTestAnswer(
    questionId: Id<"questions">,
    answer: string,
    checked: boolean,
  ) {
    setTestAnswers((current) => {
      const existingAnswer = current[questionId];
      const existingAnswers = Array.isArray(existingAnswer) ? existingAnswer : [];

      return {
        ...current,
        [questionId]: checked
          ? [...existingAnswers, answer]
          : existingAnswers.filter((item) => item !== answer),
      };
    });
  }

  async function handleSaveEquipment(equipmentId: Id<"equipment">) {
    const form = forms[equipmentId];

    if (!form) {
      return;
    }

    setSavingEquipmentId(equipmentId);

    try {
      await saveEquipment({
        equipmentId,
        name: form.name,
        category: form.category,
        description: form.description,
        videoUrl: form.videoUrl.trim() || undefined,
        instructorApprovalRequired: form.instructorApprovalRequired,
        isActive: form.isActive,
        passingScorePercent: Number(form.passingScorePercent),
        questions: form.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          choices:
            question.type === "multiple_choice"
              ? question.choices
                  .map((choice) => choice.text.trim())
                  .filter((choice) => choice.length > 0)
              : undefined,
          correctAnswer:
            question.type === "multiple_choice"
              ? JSON.stringify(
                  question.choices
                    .filter((choice) => choice.isCorrect && choice.text.trim())
                    .map((choice) => choice.text.trim()),
                )
              : question.correctAnswer.trim() || undefined,
          allowMultipleCorrect:
            question.type === "multiple_choice"
              ? question.allowMultipleCorrect
              : undefined,
          points: Number(question.points),
        })),
      });
      toast.success("Equipment saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save equipment");
    } finally {
      setSavingEquipmentId(null);
    }
  }

  async function handleSetHandsOnDemo(
    equipmentId: Id<"equipment">,
    userId: Id<"users">,
    completed: boolean,
  ) {
    const key = `${equipmentId}:${userId}`;
    setSavingSignOffKey(key);

    try {
      await setHandsOnDemonstration({ equipmentId, userId, completed });
      toast.success(completed ? "Hands-on demo checked off" : "Hands-on demo reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update sign-off");
    } finally {
      setSavingSignOffKey(null);
    }
  }

  async function handleSopUpload(
    equipmentId: Id<"equipment">,
    files: FileList | null,
  ) {
    if (!files || files.length === 0) {
      return;
    }

    const selectedFiles = [...files];
    const invalidFile = selectedFiles.find((file) => !isAllowedSopFile(file));

    if (invalidFile) {
      toast.error(`${invalidFile.name} must be a PDF, DOC, or DOCX file.`);
      return;
    }

    setUploadingSopId(equipmentId);

    try {
      for (const file of selectedFiles) {
        const uploadUrl = await generateSopUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Unable to upload ${file.name}.`);
        }

        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };

        await addSopDocument({
          equipmentId,
          storageId,
          fileName: file.name,
          contentType: file.type || undefined,
          size: file.size,
        });
      }

      toast.success(
        selectedFiles.length === 1
          ? "SOP document uploaded"
          : `${selectedFiles.length} SOP documents uploaded`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload SOP documents");
    } finally {
      setUploadingSopId(null);
    }
  }

  async function handleDeleteSopDocument(documentId: Id<"equipmentSopDocuments">) {
    setDeletingSopId(documentId);

    try {
      await deleteSopDocument({ documentId });
      toast.success("SOP document removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove SOP document");
    } finally {
      setDeletingSopId(null);
    }
  }


  async function handleMarkVideoComplete(equipmentId: Id<"equipment">) {
    setCompletingVideoId(equipmentId);

    try {
      await markEquipmentVideoComplete({ equipmentId });
      toast.success("Training video marked complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete video");
    } finally {
      setCompletingVideoId(null);
    }
  }
  async function handleSubmitSafetyTest(item: NonNullable<typeof equipment>[number]) {
    if (!item.quiz) {
      return;
    }

    setSubmittingTestId(item._id);

    try {
      const result = await submitEquipmentSafetyTest({
        equipmentId: item._id,
        answers: item.questions.map((question) => {
          const answer = testAnswers[question._id];

          return {
            questionId: question._id,
            answer: Array.isArray(answer)
              ? JSON.stringify(answer)
              : typeof answer === "string"
                ? answer
                : "",
          };
        }),
      });

      toast.success(
        result.status === "passed"
          ? `Safety test passed with ${result.scorePercent}%`
          : `Safety test submitted with ${result.scorePercent}%`,
      );
      setTestAnswers({});

      if (result.status === "passed") {
        navigate("/equipment");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit safety test");
    } finally {
      setSubmittingTestId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Equipment"
          title="Equipment sign-offs"
          description="Loading equipment records."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Equipment"
        title={equipmentRecord?.name ?? "Equipment details"}
        description="Manage this tool's video, safety test, and hands-on demonstration requirements."
        actions={
          <Button asChild variant="outline">
            <Link to="/equipment">
              <ArrowLeft className="size-4" />
              Back to equipment
            </Link>
          </Button>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load equipment</CardTitle>
            <CardDescription>
              Sign in to view equipment training and sign-offs.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-4">
          {equipment === undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Loading equipment</CardTitle>
                <CardDescription>Fetching tool records and safety tests.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {equipment?.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equipment not found</CardTitle>
                <CardDescription>
                  This tool may have been removed or is not available to your account.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {equipment?.map((item) => {
            const form = forms[item._id];
            const mySignOff = item.signOffs.find(
              (signOff) => signOff.userId === viewer?.user._id,
            );
            const hasPassedSafetyTest = item.latestQuizAttempt?.status === "passed";
            const hasCompletedVideo = item.videoProgress?.status === "completed";
            const embedUrl = youtubeEmbedUrl(item.videoUrl);
            const videoUrl = externalVideoUrl(item.videoUrl);
            const signOffByStudent = new Map(
              item.signOffs.map((signOff) => [signOff.userId, signOff]),
            );

            return (
              <Card key={item._id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Wrench className="size-5 text-primary" />
                        <CardTitle>{item.name}</CardTitle>
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {item.quiz && <Badge variant="outline">Safety test</Badge>}
                      </div>
                      <CardDescription>{item.description || item.category}</CardDescription>
                    </div>
                    {!isAdmin && mySignOff?.status === "approved" && (
                      <Badge>
                        <ShieldCheck className="size-3.5" />
                        Hands-on complete
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {!isAdmin && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-md border p-4">
                          <div className="flex items-center gap-2 font-medium">
                            <ExternalLink className="size-4 text-primary" />
                            Video
                          </div>
                          {hasCompletedVideo ? (
                            <Badge className="mt-3">
                              <CheckCircle2 className="size-3" />
                              Completed
                            </Badge>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Watch the training video, then mark it complete.
                            </p>
                          )}
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="flex items-center gap-2 font-medium">
                            <ClipboardCheck className="size-4 text-primary" />
                            Safety test
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.quiz
                              ? `${item.questions.length} questions, ${item.quiz.passingScorePercent}% to pass`
                              : "No safety test has been added yet."}
                          </p>
                          {item.latestQuizAttempt && (
                            <Badge
                              className="mt-3"
                              variant={hasPassedSafetyTest ? "default" : "secondary"}
                            >
                              {hasPassedSafetyTest ? (
                                <CheckCircle2 className="size-3" />
                              ) : (
                                <XCircle className="size-3" />
                              )}
                              {item.latestQuizAttempt.scorePercent}% latest attempt
                            </Badge>
                          )}
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="flex items-center gap-2 font-medium">
                            <ShieldCheck className="size-4 text-primary" />
                            Hands-on demo
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {mySignOff?.status === "approved"
                              ? `Completed ${formatDate(mySignOff.approvedAt)}`
                              : "Waiting for admin check-off."}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-md border p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold">Training video</h2>
                            <p className="text-sm text-muted-foreground">
                              Watch this before taking the safety test or requesting hands-on approval.
                            </p>
                          </div>
                          {hasCompletedVideo && (
                            <Badge>
                              <CheckCircle2 className="size-3" />
                              Completed {formatDate(item.videoProgress?.completedAt)}
                            </Badge>
                          )}
                        </div>
                        {embedUrl ? (
                          <iframe
                            className="aspect-video w-full rounded-md border"
                            src={embedUrl}
                            title={`${item.name} training video`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        ) : videoUrl ? (
                          <Button asChild variant="outline">
                            <a href={videoUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              Open training video
                            </a>
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No video has been added yet.
                          </p>
                        )}
                        {videoUrl && !hasCompletedVideo && (
                          <Button
                            type="button"
                            className="mt-4"
                            onClick={() => void handleMarkVideoComplete(item._id)}
                            disabled={completingVideoId === item._id}
                          >
                            <CheckCircle2 className="size-4" />
                            {completingVideoId === item._id ? "Saving..." : "Mark video complete"}
                          </Button>
                        )}
                      </div>
                      <div className="rounded-md border p-4">
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className="size-4 text-primary" />
                          SOP documents
                        </div>
                        {item.sopDocuments.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No SOP documents have been added yet.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {item.sopDocuments.map((document) => (
                              <a
                                key={document._id}
                                href={document.url ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-start gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                              >
                                <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {document.fileName}
                                  </span>
                                  <span className="block text-muted-foreground">
                                    {formatFileSize(document.size) || "Document"}
                                  </span>
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {item.quiz && item.questions.length > 0 && hasPassedSafetyTest && (
                        <div className="rounded-md border p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h2 className="text-lg font-semibold">Safety test complete</h2>
                              <p className="text-sm text-muted-foreground">
                                You passed this safety test with {item.latestQuizAttempt?.scorePercent}%.
                              </p>
                            </div>
                            <Badge>
                              <CheckCircle2 className="size-3" />
                              Passed
                            </Badge>
                          </div>
                        </div>
                      )}

                      {item.quiz && item.questions.length > 0 && !hasPassedSafetyTest && (
                        <div className="rounded-md border p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h2 className="text-lg font-semibold">Safety test</h2>
                              <p className="text-sm text-muted-foreground">
                                Answer each question, then submit for a score.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-4">
                            {item.questions.map((question, questionIndex) => {
                              const answer = testAnswers[question._id];
                              const selectedAnswers = Array.isArray(answer) ? answer : [];

                              return (
                                <div key={question._id} className="rounded-md border p-4">
                                  <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      Question {questionIndex + 1}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {question.type.replace("_", " ")}
                                    </Badge>
                                    <Badge variant="outline">{question.points} pt</Badge>
                                  </div>
                                  <p className="font-medium">{question.prompt}</p>

                                  {question.type === "multiple_choice" && (
                                    <div className="mt-4 space-y-2">
                                      {question.choices?.map((choice) => (
                                        <label
                                          key={choice}
                                          className="flex items-center gap-2 rounded-md border p-3 text-sm"
                                        >
                                          {question.allowMultipleCorrect ? (
                                            <Checkbox
                                              checked={selectedAnswers.includes(choice)}
                                              onCheckedChange={(checked) =>
                                                toggleMultiTestAnswer(
                                                  question._id,
                                                  choice,
                                                  checked === true,
                                                )
                                              }
                                            />
                                          ) : (
                                            <input
                                              type="radio"
                                              name={`${question._id}-answer`}
                                              checked={answer === choice}
                                              onChange={() =>
                                                setSingleTestAnswer(question._id, choice)
                                              }
                                              className="size-4 accent-primary"
                                            />
                                          )}
                                          {choice}
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {question.type === "true_false" && (
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                      {["true", "false"].map((choice) => (
                                        <label
                                          key={choice}
                                          className="flex items-center gap-2 rounded-md border p-3 text-sm"
                                        >
                                          <input
                                            type="radio"
                                            name={`${question._id}-answer`}
                                            checked={answer === choice}
                                            onChange={() =>
                                              setSingleTestAnswer(question._id, choice)
                                            }
                                            className="size-4 accent-primary"
                                          />
                                          {choice === "true" ? "True" : "False"}
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {question.type === "fill_blank" && (
                                    <div className="mt-4 space-y-2">
                                      <Label htmlFor={`${question._id}-answer`}>
                                        Answer
                                      </Label>
                                      <Input
                                        id={`${question._id}-answer`}
                                        value={typeof answer === "string" ? answer : ""}
                                        onChange={(event) =>
                                          setSingleTestAnswer(
                                            question._id,
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  )}

                                  {question.type === "short_answer" && (
                                    <div className="mt-4 space-y-2">
                                      <Label htmlFor={`${question._id}-response`}>
                                        Response
                                      </Label>
                                      <Textarea
                                        id={`${question._id}-response`}
                                        value={typeof answer === "string" ? answer : ""}
                                        onChange={(event) =>
                                          setSingleTestAnswer(
                                            question._id,
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  )}

                                  {question.type === "file_upload" && (
                                    <div className="mt-4 rounded-md border p-4 text-sm text-muted-foreground">
                                      File upload questions cannot be submitted here yet.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              onClick={() => void handleSubmitSafetyTest(item)}
                              disabled={submittingTestId === item._id}
                            >
                              <ClipboardCheck className="size-4" />
                              {submittingTestId === item._id
                                ? "Submitting..."
                                : "Submit safety test"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isAdmin && form && (
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${item._id}-name`}>Equipment name</Label>
                          <Input
                            id={`${item._id}-name`}
                            value={form.name}
                            onChange={(event) =>
                              patchForm(item._id, { name: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${item._id}-category`}>Category</Label>
                          <Input
                            id={`${item._id}-category`}
                            value={form.category}
                            onChange={(event) =>
                              patchForm(item._id, { category: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${item._id}-description`}>Description</Label>
                          <Textarea
                            id={`${item._id}-description`}
                            value={form.description}
                            onChange={(event) =>
                              patchForm(item._id, { description: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${item._id}-video`}>Video URL</Label>
                          <Input
                            id={`${item._id}-video`}
                            type="url"
                            value={form.videoUrl}
                            onChange={(event) =>
                              patchForm(item._id, { videoUrl: event.target.value })
                            }
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.instructorApprovalRequired}
                            onCheckedChange={(checked) =>
                              patchForm(item._id, {
                                instructorApprovalRequired: checked === true,
                              })
                            }
                          />
                          Hands-on demonstration required
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.isActive}
                            onCheckedChange={(checked) =>
                              patchForm(item._id, { isActive: checked === true })
                            }
                          />
                          Active equipment
                        </label>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold">SOP documents</h2>
                            <p className="text-sm text-muted-foreground">
                              Upload PDFs or Word documents students should review for this tool.
                            </p>
                          </div>
                          <Button asChild variant="outline">
                            <label>
                              <Upload className="size-4" />
                              {uploadingSopId === item._id ? "Uploading..." : "Upload SOP"}
                              <input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                className="sr-only"
                                disabled={uploadingSopId === item._id}
                                onChange={(event) => {
                                  void handleSopUpload(item._id, event.target.files);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </Button>
                        </div>

                        {item.sopDocuments.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No SOP documents have been uploaded yet.
                          </div>
                        )}

                        <div className="grid gap-2 md:grid-cols-2">
                          {item.sopDocuments.map((document) => (
                            <div
                              key={document._id}
                              className="flex items-start gap-3 rounded-md border p-3 text-sm"
                            >
                              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                              <a
                                href={document.url ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 flex-1 hover:text-primary"
                              >
                                <span className="block truncate font-medium">
                                  {document.fileName}
                                </span>
                                <span className="block text-muted-foreground">
                                  {formatFileSize(document.size) || "Document"}
                                </span>
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteSopDocument(document._id)}
                                disabled={deletingSopId === document._id}
                                aria-label={`Remove ${document.fileName}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold">Safety test</h2>
                            <p className="text-sm text-muted-foreground">
                              Questions saved here are linked to this equipment.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addQuestion(item._id)}
                          >
                            <Plus className="size-4" />
                            Add question
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${item._id}-passing-score`}>
                            Passing score
                          </Label>
                          <Input
                            id={`${item._id}-passing-score`}
                            type="number"
                            min={0}
                            max={100}
                            value={form.passingScorePercent}
                            onChange={(event) =>
                              patchForm(item._id, {
                                passingScorePercent: event.target.value,
                              })
                            }
                          />
                        </div>

                        {form.questions.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No safety test questions yet.
                          </div>
                        )}

                        {form.questions.map((question, questionIndex) => (
                          <div key={question.clientId} className="rounded-md border p-4">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Question {questionIndex + 1}</Badge>
                                <Badge variant="secondary">
                                  {question.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeQuestion(item._id, question.clientId)}
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Question type</Label>
                                <Select
                                  value={question.type}
                                  onValueChange={(value: QuestionType) =>
                                    updateQuestion(item._id, question.clientId, {
                                      type: value,
                                      choices:
                                        value === "multiple_choice" &&
                                        question.choices.length === 0
                                          ? createQuestion().choices
                                          : question.choices,
                                      correctAnswer:
                                        value === "true_false"
                                          ? "true"
                                          : question.correctAnswer,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="multiple_choice">
                                      Multiple choice
                                    </SelectItem>
                                    <SelectItem value="true_false">True / false</SelectItem>
                                    <SelectItem value="fill_blank">
                                      Fill in the blank
                                    </SelectItem>
                                    <SelectItem value="short_answer">
                                      Short answer
                                    </SelectItem>
                                    <SelectItem value="file_upload">File upload</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`${question.clientId}-points`}>
                                  Points
                                </Label>
                                <Input
                                  id={`${question.clientId}-points`}
                                  type="number"
                                  min={1}
                                  value={question.points}
                                  onChange={(event) =>
                                    updateQuestion(item._id, question.clientId, {
                                      points: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={`${question.clientId}-prompt`}>
                                  Prompt
                                </Label>
                                <Textarea
                                  id={`${question.clientId}-prompt`}
                                  value={question.prompt}
                                  onChange={(event) =>
                                    updateQuestion(item._id, question.clientId, {
                                      prompt: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              {question.type === "multiple_choice" && (
                                <div className="space-y-3 md:col-span-2">
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={question.allowMultipleCorrect}
                                      onCheckedChange={(checked) =>
                                        updateQuestion(item._id, question.clientId, {
                                          allowMultipleCorrect: checked === true,
                                          choices:
                                            checked === true
                                              ? question.choices
                                              : question.choices.map(
                                                  (choice, choiceIndex) => ({
                                                    ...choice,
                                                    isCorrect:
                                                      choice.isCorrect &&
                                                      !question.choices
                                                        .slice(0, choiceIndex)
                                                        .some(
                                                          (priorChoice) =>
                                                            priorChoice.isCorrect,
                                                        ),
                                                  }),
                                                ),
                                        })
                                      }
                                    />
                                    Allow multiple correct answers
                                  </label>
                                  <div className="space-y-2">
                                    {question.choices.map((choice, choiceIndex) => (
                                      <div
                                        key={choice.clientId}
                                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
                                      >
                                        {question.allowMultipleCorrect ? (
                                          <Checkbox
                                            checked={choice.isCorrect}
                                            onCheckedChange={(checked) =>
                                              setChoiceCorrect(
                                                item._id,
                                                question.clientId,
                                                choice.clientId,
                                                checked === true,
                                              )
                                            }
                                            aria-label={`Mark option ${choiceIndex + 1} correct`}
                                          />
                                        ) : (
                                          <input
                                            type="radio"
                                            name={`${question.clientId}-correct-choice`}
                                            checked={choice.isCorrect}
                                            onChange={() =>
                                              setChoiceCorrect(
                                                item._id,
                                                question.clientId,
                                                choice.clientId,
                                                true,
                                              )
                                            }
                                            aria-label={`Mark option ${choiceIndex + 1} correct`}
                                            className="size-4 accent-primary"
                                          />
                                        )}
                                        <Input
                                          value={choice.text}
                                          onChange={(event) =>
                                            updateChoice(
                                              item._id,
                                              question.clientId,
                                              choice.clientId,
                                              event.target.value,
                                            )
                                          }
                                          placeholder={`Option ${choiceIndex + 1}`}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            removeChoice(
                                              item._id,
                                              question.clientId,
                                              choice.clientId,
                                            )
                                          }
                                          disabled={question.choices.length <= 2}
                                          aria-label={`Remove option ${choiceIndex + 1}`}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addChoice(item._id, question.clientId)}
                                  >
                                    <Plus className="size-4" />
                                    Add option
                                  </Button>
                                </div>
                              )}
                              {question.type !== "file_upload" &&
                                question.type !== "multiple_choice" && (
                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`${question.clientId}-answer`}>
                                      Correct answer
                                    </Label>
                                    <Input
                                      id={`${question.clientId}-answer`}
                                      value={question.correctAnswer}
                                      onChange={(event) =>
                                        updateQuestion(item._id, question.clientId, {
                                          correctAnswer: event.target.value,
                                        })
                                      }
                                      placeholder={
                                        question.type === "true_false"
                                          ? "true or false"
                                          : "Answer key"
                                      }
                                    />
                                  </div>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div>
                          <h2 className="text-lg font-semibold">
                            Hands-on demonstrations
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Check off students after they safely demonstrate this tool.
                          </p>
                        </div>
                        {usersReadyForSignOff === undefined && (
                          <p className="text-sm text-muted-foreground">
                            Loading passed safety tests...
                          </p>
                        )}
                        {usersReadyForSignOff?.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No accounts have passed this safety test yet.
                          </div>
                        )}
                        <div className="grid gap-2 md:grid-cols-2">
                          {usersReadyForSignOff?.map((user) => {
                            const signOff = signOffByStudent.get(user.userId);
                            const completed = signOff?.status === "approved";
                            const signOffKey = `${item._id}:${user.userId}`;

                            return (
                              <label
                                key={user.userId}
                                className="flex items-start gap-3 rounded-md border p-3 text-sm"
                              >
                                <Checkbox
                                  checked={completed}
                                  disabled={savingSignOffKey === signOffKey}
                                  onCheckedChange={(checked) =>
                                    void handleSetHandsOnDemo(
                                      item._id,
                                      user.userId,
                                      checked === true,
                                    )
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-medium">
                                    {user.displayName ?? user.email ?? "Account"}
                                  </span>
                                  <span className="block text-muted-foreground">
                                    {completed
                                      ? `Completed ${formatDate(signOff?.approvedAt)}`
                                      : `Passed safety test${user.scorePercent === undefined ? "" : ` with ${user.scorePercent}%`}`}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleSaveEquipment(item._id)}
                          disabled={savingEquipmentId === item._id}
                        >
                          <Save className="size-4" />
                          {savingEquipmentId === item._id ? "Saving..." : "Save equipment"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Authenticated>
    </div>
  );
}





