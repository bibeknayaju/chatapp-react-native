import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import React, { useContext, useEffect, useState } from "react";
import { UserType } from "../UserContext";
import axios from "axios";
import UserChat from "../components/UserChat";

const ChatsScreen = () => {
  const [acceptedFriends, setAcceptedFriends] = useState([]);
  const { userId, setUserId } = useContext(UserType);

  useEffect(() => {
    const fetchAcceptedFriends = async () => {
      const resopnse = await axios.get(
        `http://localhost:8000/accepted-friends/${userId}`
      );
      if (resopnse.status === 200) {
        setAcceptedFriends(resopnse.data);
      }
    };

    fetchAcceptedFriends();
  }, []);
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Pressable>
        {acceptedFriends.map((item, index) => (
          <UserChat key={index} item={item} />
        ))}
      </Pressable>
    </ScrollView>
  );
};

export default ChatsScreen;

const styles = StyleSheet.create({});
