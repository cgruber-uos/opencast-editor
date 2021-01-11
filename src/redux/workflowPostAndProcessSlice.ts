import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { client } from '../util/client'
import { PostAndProcessEditArgument, httpRequestState } from '../types'

import { convertSegments } from './workflowPostSlice'

const initialState: httpRequestState = {
  status: 'idle',
  error: undefined,
}

export const postVideoInformationWithWorkflow = createAsyncThunk('video/postVideoInformationWithWorkflow', async (argument: PostAndProcessEditArgument) => {
  const response = await client.post(`${argument.ocUrl}/editor/${argument.mediaPackageId}/edit.json`,
    { segments: convertSegments(argument.segments), tracks: argument.tracks, workflows: argument.workflowID }
  )
  return response
})

/**
 * Slice for managing a post request for saving current changes and starting a workflow
 * TODO: Create a wrapper for this and workflowPostAndProcessSlice
 */
const workflowPostAndProcessSlice = createSlice({
  name: 'workflowPostAndProcessState',
  initialState,
  reducers: {
  },
  extraReducers: builder => {
    builder.addCase(
      postVideoInformationWithWorkflow.pending, (state, action) => {
        state.status = 'loading'
    })
    builder.addCase(
      postVideoInformationWithWorkflow.fulfilled, (state, action) => {
        state.status = 'success'
    })
    builder.addCase(
      postVideoInformationWithWorkflow.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
    })
  }
})

export const selectStatus = (state: { workflowPostAndProcessState: { status: httpRequestState["status"] } }) =>
  state.workflowPostAndProcessState.status
export const selectError = (state: { workflowPostAndProcessState: { error: httpRequestState["error"] } }) =>
  state.workflowPostAndProcessState.error


export default workflowPostAndProcessSlice.reducer
