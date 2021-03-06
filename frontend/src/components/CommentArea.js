import MuiDialogContent from '@material-ui/core/DialogContent';
import Typography from '@material-ui/core/Typography';
import Avatar from '@material-ui/core/Avatar';
import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { useContext, useState,useEffect } from 'react';
import Comment from './Comment';
import { createComment,deleteComment } from '../services/JournalServices';
import AuthContext from '../authAPI/auth-context';

function CommentArea(props) {
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState(props.comments);
    const auth = useContext(AuthContext);

    const handleCommentChange = (e) => {
        setComment(e.target.value);
    };
    const handlePost = async () => {
        createComment(
            props.journalID,
            auth.token,
            new window.Date(),
            comment,
            false
        )
            .then((updatedJournal) => {
                setComments(updatedJournal.comments);
                // update the list of journals so that the new comment renders when users close and open the modal again
                props.onRefreshOneJournal(updatedJournal);
                setComment('');
            })
            .catch((err) => {
                alert('Failed to comment the journal, please try again later.');
                console.log(err);
            });
    };
    const handleDeleteComment = async (commentId) => {
        const updatedJournal = await deleteComment(props.journalID,commentId);
        props.onRefreshOneJournal(updatedJournal);
    };

    const areCommentsEmpty = props.comments.length === 0;

    useEffect(()=>{
        setComments(props.comments);
    },[props.comments])

    return (
        <>
            {!areCommentsEmpty && (
                <Box minHeight='120px' style={{ overflow: 'scroll' }}>
                    <MuiDialogContent>
                        <Typography component={'span'}>
                            {comments.map((c) => (
                             <Comment
                                key={c._id}
                                id={c._id}
                                comment={c}
                                journalID={props.journalID}
                                handleDeleteComment={handleDeleteComment}
                                myName={auth.userName}
                                authorMode={props.authorMode}
                            />
                            )
                            
                            )}
                        </Typography>
                    </MuiDialogContent>
                </Box>
            )}
            {areCommentsEmpty && (
                <Box
                    display='flex'
                    justifyContent='center'
                    alignItems='center'
                    mb={3}
                >
                    <Typography
                        variant='h6'
                        component={'span'}
                        gutterBottom
                        color='primary'
                    >
                        No comments are present, you can be the first ~!
                    </Typography>
                </Box>
            )}

            {auth.isLoggedIn &&
                <MuiDialogContent dividers>
                    <Typography component={'span'}>
                        <Box display='flex'>
                            <Avatar>ME</Avatar>
                            <Box mx={3} width={'70%'}>
                                <TextField
                                    size='small'
                                    multiline
                                    fullWidth
                                    id='outlined-basic'
                                    placeholder='write your comment'
                                    variant='outlined'
                                    onChange={handleCommentChange}
                                    value={comment}
                                />
                            </Box>
                            <Button
                                variant='contained'
                                color='primary'
                                onClick={handlePost}
                            >
                                {' '}
                                post
                            </Button>
                        </Box>
                    </Typography>
                </MuiDialogContent>
            }
        </>
    );
}
export default CommentArea;
