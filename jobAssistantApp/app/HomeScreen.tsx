import React, { useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import ResumeUploader from './ResumeUploader';
import axios, { AxiosError } from 'axios';
import styles from '../styles/HomeScreenStyles';
import JobCard from '../components/JobCard';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function HomeScreen() {
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ type: 'user' | 'bot'; message: string; imageUri?: string; jobData?: any }>>([]);
  const [showResumeUploader, setShowResumeUploader] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (chatInput.trim()) {
        setChatMessages([...chatMessages, { type: 'user', message: chatInput }]);
        const userMessage = chatInput;
        setChatInput('');

        setChatMessages((prev) => [...prev, { type: 'bot', message: 'Analyzing your request...' }]);

        try {
            const aiResponse = await axios.post(
                'https://api.cohere.com/v2/chat',
              {
                  "model": "command-r",
                  "stream": false,
                  "messages": [
                      {
                          "role": "system",
                          "content": `You are an AI assistant that extracts job search parameters for a job search API in the following format: 
                          query, employment_types, date_posted, work_from_home, job_requirements. 

                          Return 'NULL' if a parameter is not specified except 'query'. 

                          Parameter Specifications:
                          - 'query': The job title or search term. Include job title and location as part of the query. e.g. Cybersecurity Indonesia. If not specified or cannot be extracted, return 'any'.
                          - 'employment_types': One of ['FULLTIME', 'CONTRACTOR', 'PARTTIME', 'INTERN']. Return 'NULL' if not specified.
                          - 'date_posted': One of ['all', 'today', '3days', 'week', 'month']. Return 'all' if not specified.
                          - 'work_from_home': Boolean (true/false). Return false if not specified.
                          - 'job_requirements': One of ['under_3_years_experience', 'more_than_3_years_experience', 'no_experience', 'no_degree']. Return 'NULL' if not specified.

                          Format the output as a JSON object with accurate data types. Do not give any comments.`
                      },
                      {
                          "role": "user",
                          "content": userMessage
                      }
                  ],
                  "response_format": {
                      "type": "json_object",
                      "json_schema": {
                          "type": "object",
                          "properties": {
                              "query": { "type": ["string", "null"] },
                              "employment_types": { "type": ["string", "null"] },
                              "date_posted": { "type": ["string", "null"] },
                              "work_from_home": { "type": ["string", "null"] },
                              "job_requirements": { "type": ["string", "null"] }
                          },
                          "required": ["query"]
                      }
                  }
              },
              {
                  headers: { 
                      'Authorization': `Bearer zsj4YqArScI9DstfAagiMA2MyomIqAd6BYp2Q0Kr`,
                      'Content-Type': 'application/json',
                  },
              }
            );

            console.log('AI Response:', aiResponse.data);

            const { query, employment_types, date_posted, work_from_home, job_requirements} = aiResponse.data.message.content[0].text
            ? JSON.parse(aiResponse.data.message.content[0].text)
            : {};

            const params: Record<string, any> = { num_pages: 1 };
            console.log('params sent',params);

            if (query && query !== 'NULL') params.query = encodeURI(query);
            if (employment_types && employment_types !== 'NULL') params.employment_types = employment_types;
            if (date_posted && date_posted !== 'NULL') params.date_posted = date_posted;
            if (work_from_home !== null && work_from_home !== 'NULL'  && work_from_home !== undefined) params.work_from_home = work_from_home;

            if (job_requirements && job_requirements !== 'NULL') {
              params.job_requirements = job_requirements;
            }
            console.log('Final API Params:', params);

            // Step 2: Use the summary to search for jobs
            const response = await axios.get(
                'https://jsearch.p.rapidapi.com/search',
                {
                    params,
                    headers: {
                        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
                        'x-rapidapi-key': 'd95b66b6a6mshf4186aaaff140cdp1fe228jsn849750b69437'
                    }
                }
            );

            const jobs = response.data?.data ?? [];

            if (jobs.length > 0) {
                const jobCards = jobs.slice(0, 5).map((job: any, index: number) => ({
                    type: 'bot',
                    message: '',
                    jobData: {
                        title: job.job_title,
                        company: job.employer_name,
                        location: job.job_location,
                        description: job.job_description,
                        applyLink: job.job_apply_link,
                        logo: job.employer_logo,
                    }
                }));

                setChatMessages((prev) => [
                    ...prev.slice(0, -1),
                    ...jobCards,
                ]);
            } else {
                setChatMessages((prev) => [
                    ...prev.slice(0, -1),
                    { type: 'bot', message: 'No relevant jobs found. Try refining your search!' },
                ]);
            }

        } catch (error: unknown) {
            const axiosError = error as AxiosError;
            console.error('Error communicating with API:', axiosError.response?.data || axiosError.message);
            setChatMessages((prev) => [
                ...prev.slice(0, -1),
                { type: 'bot', message: 'Error: Unable to connect to the job search API.' },
            ]);
        }
    }
};
  const handleResumeUpload = (fileName: string) => {
    setChatMessages((prev) => [
        ...prev,
        { type: 'bot', message: `Resume "${fileName}" uploaded successfully.` }
    ]);
    setShowResumeUploader(false);
  };



return (
  <View style={styles.container}>
    <ScrollView
      style={styles.chatContainer}
      ref={scrollViewRef}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
    >
      {chatMessages.map((chat, index) => (
        <View
          key={index}
          style={[
            styles.chatBubble,
            chat.type === 'user' ? styles.userBubble : styles.botBubble,
          ]}
        >
          {chat.jobData ? (
            <JobCard
              title={chat.jobData.title}
              company={chat.jobData.company}
              location={chat.jobData.location}
              description={chat.jobData.description}
              applyLink={chat.jobData.applyLink}
              logo={chat.jobData.logo}
            />
          ) : (
            <Text style={styles.chatText}>{chat.message}</Text>
          )}
        </View>
      ))}
    </ScrollView>

    {showResumeUploader && 
        <ResumeUploader 
            onUploadSuccess={handleResumeUpload} 
            onClose={() => setShowResumeUploader(false)} 
        />
    }


    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.chatInputContainer}
    >
      <TouchableOpacity style={styles.pinButton} onPress={() => setShowResumeUploader(true)}>
        <Icon name="attach-file" size={24} color="#10a37f" />
      </TouchableOpacity>

      <TextInput
        style={styles.chatInput}
        placeholder="Type a message..."
        placeholderTextColor="#aaa"
        value={chatInput}
        onChangeText={setChatInput}
        multiline={true}
      />

      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Text style={styles.sendButtonText}>➤</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  </View>
  );
}