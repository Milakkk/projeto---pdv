import type { TaskComment } from '../../../types';
import Button from '../../../components/base/Button';
import { useAuth } from '../../../context/AuthContext';
import { useState } from 'react';

interface TaskCommentsProps {
  comments: TaskComment[];
  onUpdateComments: (updatedComments: TaskComment[]) => void; // Renomeado para refletir a atualização completa
}

export default function TaskComments({ comments, onUpdateComments }: TaskCommentsProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  
  const handleAddComment = () => {
    if (!user) return;
    
    if (newComment.trim()) {
      const newCommentObj: TaskComment = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.name,
        timestamp: new Date(),
        content: newComment.trim(),
      };
      
      onUpdateComments([...comments, newCommentObj]);
      setNewComment('');
    }
  };

  const handleStartEdit = (comment: TaskComment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editingCommentId || !editingContent.trim()) return;

    const updatedComments = comments.map(c => 
      c.id === editingCommentId 
        ? { ...c, content: editingContent.trim(), timestamp: new Date() } // Atualiza o timestamp
        : c
    );
    
    onUpdateComments(updatedComments);
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm('Tem certeza que deseja excluir este comentário?')) {
      const updatedComments = comments.filter(c => c.id !== commentId);
      onUpdateComments(updatedComments);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 flex items-center">
        <i className="ri-chat-3-line mr-2 text-blue-600"></i>
        Comentários ({comments.length})
      </h4>

      {/* Formulário para Novo Comentário */}
      <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={`Adicionar um comentário como ${user?.name || 'Usuário'}`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          rows={2}
          maxLength={500}
          disabled={!!editingCommentId}
        />
        <div className="flex justify-end mt-2">
          <Button 
            size="sm" 
            onClick={handleAddComment} 
            disabled={!newComment.trim() || !!editingCommentId}
            variant="info"
          >
            <i className="ri-send-plane-line mr-2"></i>
            Comentar
          </Button>
        </div>
      </div>

      {/* Lista de Comentários */}
      <div className="max-h-64 overflow-y-auto space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center py-4">
            Nenhum comentário ainda.
          </p>
        ) : (
          comments
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((comment) => {
              const isEditing = editingCommentId === comment.id;
              const isCurrentUser = user?.id === comment.userId;
              
              return (
                <div key={comment.id} className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-800">
                      {comment.userName}
                      {isCurrentUser && <span className="ml-2 text-blue-500">(Você)</span>}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {isEditing ? (
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none focus:ring-blue-500"
                      rows={2}
                      maxLength={500}
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {comment.content}
                    </p>
                  )}

                  <div className="flex justify-end space-x-2 mt-2 pt-2 border-t border-gray-100">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditingCommentId(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editingContent.trim()}>
                          <i className="ri-save-line mr-1"></i>
                          Salvar
                        </Button>
                      </>
                    ) : isCurrentUser ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleStartEdit(comment)}>
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteComment(comment.id)}>
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
