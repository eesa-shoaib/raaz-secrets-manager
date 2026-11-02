import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { createProjectSchema, type CreateProjectInput } from '@raaz/shared-schemas';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/PageHeader';
import { ProjectCard } from '../components/ProjectCard';
import { Skeleton } from '../components/LoadingSkeleton';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { useToast } from '../components/Toaster';
import { isApiError } from '../lib/errorHandling';

export function ProjectsPage() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
    },
  });

  const handleOpenModal = () => {
    reset();
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setModalError(null);
  };

  const onSubmit = async (data: CreateProjectInput) => {
    setModalError(null);
    try {
      const created = await createProject(data);
      toast.success(`Project "${created.name}" created successfully`);
      handleCloseModal();
      navigate(`/projects/${created.id}/secrets`);
    } catch (err: unknown) {
      if (isApiError(err)) {
        setModalError(err.message || 'Failed to create project');
      } else {
        setModalError('Something went wrong — the action was not applied');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage encrypted secrets and team memberships across environments"
        actions={
          <button
            type="button"
            onClick={handleOpenModal}
            className="btn btn-primary text-base-300 font-semibold rounded-xl flex items-center gap-2 hover:opacity-90"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        }
      />

      {isLoading ? (
        <Skeleton shape="card" count={3} />
      ) : isError ? (
        <ErrorState
          message={
            isApiError(error)
              ? error.message
              : 'Failed to load projects. Please try again.'
          }
          onRetry={() => refetch()}
        />
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          description={
            <span>
              You&apos;re not a member of any projects yet. Create a project, or ask a
              Project Admin to add you using your email address:{' '}
              <strong className="text-base-content font-mono font-semibold">
                {user?.email}
              </strong>
              .
            </span>
          }
          action={
            <button
              type="button"
              onClick={handleOpenModal}
              className="btn btn-primary text-base-300 font-semibold rounded-xl"
            >
              New Project
            </button>
          }
        />
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Create New Project"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {modalError && (
            <div role="alert" className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium">
              <span>{modalError}</span>
            </div>
          )}

          <FormField
            label="Project Name"
            hint="A clear, human-readable name for your project"
            error={errors.name?.message}
            required
          >
            {({ id, ...props }) => (
              <input
                id={id}
                type="text"
                placeholder="e.g. Payment Gateway"
                autoFocus
                className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                  errors.name ? 'input-error' : ''
                }`}
                {...register('name')}
                {...props}
              />
            )}
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isCreating}
              className="btn btn-ghost rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="btn btn-primary text-base-300 font-semibold rounded-xl text-sm"
            >
              {isCreating ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ProjectsPage;
